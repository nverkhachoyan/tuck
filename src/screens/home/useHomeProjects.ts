import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
	closeDocument,
	getSession,
	openDocument,
	renderThumbnail,
} from "@/editor";
import { createDocumentFromImage, type EditorDocument } from "@/model/document";
import { pasteClipboardImage } from "@/photos/clipboardImage";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/photos/photoImport";
import { importSharedPhoto } from "@/photos/sharedPhoto";
import { copyName, type ProjectSummary } from "@/projects/projectFile";
import { isProjectOpenElsewhere } from "@/projects/projectLifecycle";
import { editorHref } from "@/projects/projectRoute";
import {
	closeProject,
	copyOpenProject,
	createProject,
	deleteProject,
	duplicateProject,
	listProjects,
	openProject,
	renameProject,
	updateThumbnail,
} from "@/projects/projectService";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";

// A null id edits a photo that couldn't be saved.
type Opened = { id: string | null; document: EditorDocument } | null;

export type HomeStatus =
	| "loading"
	| "saving"
	| "saveFailed"
	| "opening"
	| "idle";

/**
 * One piece of work runs at a time, and `status` names it. Between them,
 * thumbnails that a session ending without Back left missing or outdated
 * are rendered again.
 */
export function useHomeProjects() {
	const router = useRouter();
	const [status, setStatus] = useState<HomeStatus>("loading");
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	// Whether the list has loaded once, so its empty state can show.
	const [listed, setListed] = useState(false);
	// Picking plus re-encoding a large photo takes a few seconds, and so can
	// saving. Set at once, so a second tap meanwhile can't start more work
	// before the status re-renders.
	const busy = useRef(false);
	// Counts passes over the list's outdated thumbnails. Any other work, or
	// leaving the screen, ends the current one.
	const thumbnailPass = useRef(0);

	const run = useCallback(
		async (during: HomeStatus, work: () => Promise<HomeStatus | undefined>) => {
			if (busy.current) return;
			busy.current = true;
			thumbnailPass.current++;
			setStatus(during);
			let after: HomeStatus | undefined;
			try {
				after = await work();
			} finally {
				busy.current = false;
				setStatus(after ?? "idle");
			}
		},
		[],
	);

	// One at a time, so the list stays responsive, each card updating as its
	// thumbnail lands.
	const updateThumbnails = useCallback(async (list: ProjectSummary[]) => {
		const pass = ++thumbnailPass.current;
		for (const project of list) {
			if (pass !== thumbnailPass.current) return;
			if (project.status !== "ready" || !project.thumbnailOutdated) continue;
			const thumbnail = await updateThumbnail(project.id, renderThumbnail);
			if (!thumbnail || pass !== thumbnailPass.current) continue;
			setProjects((current) =>
				current.map((listed) =>
					listed.id === project.id && listed.status === "ready"
						? { ...listed, thumbnail, thumbnailOutdated: false }
						: listed,
				),
			);
		}
	}, []);

	const refreshProjects = useCallback(async () => {
		try {
			const list = await listProjects();
			setProjects(list);
			void updateThumbnails(list);
		} catch (error) {
			showAlert("Couldn't load your projects", errorMessage(error));
		} finally {
			setListed(true);
		}
	}, [updateThumbnails]);

	// Coming back here, however the editor was left, ends that session: its
	// last edits are saved, and the list shows them.
	const finishSession = useCallback(() => {
		const { document, key: projectId } = getSession();
		return run(document && projectId ? "saving" : "loading", async () => {
			if (document && projectId) {
				try {
					await closeProject(projectId, document, renderThumbnail);
				} catch (error) {
					showAlert("Couldn't save your edits", errorMessage(error));
					return "saveFailed";
				}
			}
			// Unless a link to another project ended it first.
			if (document && getSession().document === document) {
				closeDocument();
			}
			await refreshProjects();
		});
	}, [run, refreshProjects]);

	useFocusEffect(
		useCallback(() => {
			void finishSession();
			return () => {
				thumbnailPass.current++;
			};
		}, [finishSession]),
	);

	const open = (failure: string, load: () => Promise<Opened>) => {
		if (getSession().document) return;
		return run("opening", async () => {
			try {
				const opened = await load();
				if (opened) {
					openDocument(opened.document, opened.id);
					router.push(editorHref(opened.id));
				}
			} catch (error) {
				showAlert(failure, errorMessage(error));
				// The list may be out of date, as when another tab deleted a project.
				await refreshProjects();
			}
		});
	};

	// Without storage, the photo can still be edited, just not kept.
	const openPhoto = (photo: PickedPhoto) =>
		createProject(photo).catch((error: unknown) => {
			console.warn("Couldn't save the photo as a project", error);
			const { uri, width, height, opaque } = photo;
			return {
				id: null,
				document: createDocumentFromImage(uri, width, height, opaque),
			};
		});

	const choosePhoto = () =>
		open("Couldn't open photo", async () => {
			const result = await pickPhoto();
			if (result.status === "canceled") return null;
			return openPhoto(result.photo);
		});

	/** Opens a pasted or dropped image, as a chosen photo opens. */
	const openImage = (uri: string) =>
		open("Couldn't open image", async () => openPhoto(await importPhoto(uri)));

	/** Opens a photo shared from another app, as a chosen photo opens. */
	const openSharedPhoto = (name: string) =>
		open("Couldn't open the shared photo", async () =>
			openPhoto(await importSharedPhoto(name)),
		);

	/** Reads the clipboard only from this user action, so iOS can prompt here. */
	const pasteImage = () =>
		open("Couldn't paste image", async () => {
			const uri = await pasteClipboardImage();
			if (!uri) {
				showAlert(
					"No image to paste",
					"Copy a photo or screenshot first, then tap Paste.",
				);
				return null;
			}
			return openPhoto(await importPhoto(uri));
		});

	// After the alert closes, so it isn't nested inside the open that failed.
	const openCopy = (id: string) =>
		open("Couldn't open a copy", async () => {
			const copyId = await copyOpenProject(id);
			const document = await openProject(copyId);
			if (!document) {
				showAlert(
					"Couldn't open project",
					"It may have been saved by a newer version of the app.",
				);
			}
			return document && { id: copyId, document };
		});

	const openSavedProject = (id: string) =>
		open("Couldn't open project", async () => {
			try {
				const document = await openProject(id);
				if (!document) {
					showAlert(
						"Couldn't open project",
						"It may have been saved by a newer version of the app.",
					);
				}
				return document && { id, document };
			} catch (error) {
				if (!isProjectOpenElsewhere(error)) throw error;
				showAlert("Couldn't open project", errorMessage(error), [
					{ text: "Cancel", style: "cancel" },
					{ text: "Open a copy", onPress: () => void openCopy(id) },
				]);
				return null;
			}
		});

	const confirmDeleteProject = (id: string) =>
		showAlert(
			"Delete project?",
			"Its photos and edits will be removed from this device.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () =>
						run("loading", async () => {
							try {
								await deleteProject(id);
							} catch (error) {
								showAlert("Couldn't delete project", errorMessage(error));
							}
							await refreshProjects();
						}),
				},
			],
		);

	// Changes a saved project in place, then lists them all again.
	const changeProject = (failure: string, change: () => Promise<void>) =>
		run("saving", async () => {
			try {
				await change();
			} catch (error) {
				showAlert(failure, errorMessage(error));
			}
			await refreshProjects();
		});

	const renameSavedProject = (id: string, name: string) =>
		changeProject("Couldn't rename project", () => renameProject(id, name));

	// Named for the original, as the first copy of it not yet listed.
	const duplicateSavedProject = (id: string) => {
		const original = projects.find((project) => project.id === id);
		if (original?.status !== "ready") return;
		const labels = projects.flatMap((project) =>
			project.status === "ready" ? [project.label] : [],
		);
		return changeProject("Couldn't duplicate project", () =>
			duplicateProject(id, copyName(original.label, labels)),
		);
	};

	return {
		status,
		projects,
		listed,
		finishSession,
		choosePhoto,
		openImage,
		openSharedPhoto,
		pasteImage,
		openProject: openSavedProject,
		renameProject: renameSavedProject,
		duplicateProject: duplicateSavedProject,
		deleteProject: confirmDeleteProject,
	};
}
