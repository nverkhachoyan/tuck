import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/import/photoImport";
import { errorMessage } from "@/lib/errorMessage";
import { showAlert } from "@/lib/showAlert";
import { createDocumentFromImage, type EditorDocument } from "@/model/document";
import type { ProjectSummary } from "@/projects/projectFile";
import {
	closeProject,
	createProject,
	deleteProject,
	listProjects,
	openProject,
} from "@/projects/projectService";
import { renderThumbnail } from "@/render/renderDocument";
import { useStore } from "@/store";

// A null id edits a photo that couldn't be saved.
type Opened = { id: string | null; document: EditorDocument } | null;

export type HomeStatus =
	| "loading"
	| "saving"
	| "saveFailed"
	| "opening"
	| "idle";

/**
 * The saved projects, and the home screen's work on them: ending the editor's
 * session on coming back here, and opening a photo or project in the editor.
 * One piece of work runs at a time, and `status` names it.
 */
export function useHomeProjects() {
	const openDocument = useStore((state) => state.openDocument);
	const closeDocument = useStore((state) => state.closeDocument);
	const router = useRouter();
	const [status, setStatus] = useState<HomeStatus>("loading");
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	// Whether the list has loaded once, so its empty state can show.
	const [listed, setListed] = useState(false);
	// Picking plus re-encoding a large photo takes a few seconds, and so can
	// saving. Set at once, so a second tap meanwhile can't start more work
	// before the status re-renders.
	const busy = useRef(false);

	const run = useCallback(
		async (during: HomeStatus, work: () => Promise<HomeStatus | undefined>) => {
			if (busy.current) return;
			busy.current = true;
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

	const refreshProjects = useCallback(async () => {
		try {
			setProjects(await listProjects());
		} catch (error) {
			showAlert("Couldn't load your projects", errorMessage(error));
		} finally {
			setListed(true);
		}
	}, []);

	// Coming back here, however the editor was left, ends that session: its
	// last edits are saved, and the list shows them.
	const finishSession = useCallback(() => {
		const { document, projectId } = useStore.getState();
		return run(document && projectId ? "saving" : "loading", async () => {
			if (document && projectId) {
				try {
					await closeProject(projectId, document, renderThumbnail);
				} catch (error) {
					showAlert("Couldn't save your edits", errorMessage(error));
					return "saveFailed";
				}
			}
			if (document) closeDocument();
			await refreshProjects();
		});
	}, [run, closeDocument, refreshProjects]);

	useFocusEffect(
		useCallback(() => {
			void finishSession();
		}, [finishSession]),
	);

	const open = (failure: string, load: () => Promise<Opened>) => {
		if (useStore.getState().document) return;
		return run("opening", async () => {
			try {
				const opened = await load();
				if (opened) {
					openDocument(opened.document, opened.id);
					router.push("/editor");
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

	const openSavedProject = (id: string) =>
		open("Couldn't open project", async () => {
			const document = await openProject(id);
			if (!document) {
				showAlert(
					"Couldn't open project",
					"It may have been saved by a newer version of the app.",
				);
			}
			return document && { id, document };
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

	return {
		status,
		projects,
		listed,
		finishSession,
		choosePhoto,
		openImage,
		openProject: openSavedProject,
		deleteProject: confirmDeleteProject,
	};
}
