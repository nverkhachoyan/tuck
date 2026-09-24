import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { renderThumbnail } from "@/export/renderDocument";
import { pickPhoto } from "@/import/pickPhoto";
import { errorMessage } from "@/lib/errorMessage";
import { showAlert } from "@/lib/showAlert";
import { createDocumentFromImage, type EditorDocument } from "@/model/document";
import { ProjectList } from "@/projects/ProjectList";
import type { ProjectSummary } from "@/projects/projectFile";
import {
	closeProject,
	createProject,
	deleteProject,
	listProjects,
	openProject,
} from "@/projects/projects";
import { useStore } from "@/store";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";

// A null id edits a photo that couldn't be saved.
type Opened = { id: string | null; document: EditorDocument } | null;

type Status = "loading" | "saving" | "saveFailed" | "opening" | "idle";

const choosePhotoLabels: Record<Status, string> = {
	loading: "Loading…",
	saving: "Saving…",
	saveFailed: "Choose Photo",
	opening: "Opening…",
	idle: "Choose Photo",
};

export default function WelcomeRoute() {
	const openDocument = useStore((state) => state.openDocument);
	const closeDocument = useStore((state) => state.closeDocument);
	const router = useRouter();
	const [status, setStatus] = useState<Status>("loading");
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	// Picking plus re-encoding a large photo takes a few seconds, and so can
	// saving. Set at once, so a second tap meanwhile can't start more work
	// before the status re-renders.
	const busy = useRef(false);

	const run = useCallback(
		async (during: Status, work: () => Promise<Status | undefined>) => {
			if (busy.current) return;
			busy.current = true;
			setStatus(during);
			let after: Status | undefined;
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

	const handleChoosePhoto = () =>
		open("Couldn't open photo", async () => {
			const result = await pickPhoto();
			if (result.status === "canceled") return null;
			// Without storage, the photo can still be edited, just not kept.
			return createProject(result.photo).catch((error: unknown) => {
				console.warn("Couldn't save the photo as a project", error);
				const { uri, width, height } = result.photo;
				return {
					id: null,
					document: createDocumentFromImage(uri, width, height),
				};
			});
		});

	const handleOpenProject = (id: string) =>
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

	const handleDeleteProject = (id: string) =>
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

	const hasProjects = projects.length > 0;
	const blocked = status !== "idle";

	return (
		<View style={styles.container}>
			<View style={[styles.intro, !hasProjects && styles.fill]}>
				<View style={styles.logoMark} />
				<Text style={styles.title}>Tuck</Text>
				<Text style={styles.subtitle}>
					The last touch for photos and screenshots. No account, no waiting.
				</Text>
			</View>

			{hasProjects && (
				<ProjectList
					projects={projects}
					disabled={blocked}
					onOpen={handleOpenProject}
					onDelete={handleDeleteProject}
				/>
			)}

			{status === "saveFailed" && (
				<View style={styles.saveRecovery}>
					<Text style={styles.saveRecoveryText}>
						Your edits are still open. Retry saving or return to the editor.
					</Text>
					<View style={styles.saveActions}>
						<Button label="Retry Save" onPress={finishSession} />
						<Button
							label="Return to Editor"
							onPress={() => router.push("/editor")}
						/>
					</View>
				</View>
			)}

			<View style={styles.actions}>
				<Button
					label={choosePhotoLabels[status]}
					variant="primary"
					size="large"
					disabled={blocked}
					onPress={handleChoosePhoto}
				/>
				<Button
					label="Create"
					size="large"
					disabled={blocked}
					onPress={() => router.push("/create")}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// A phone-width column, so a wide browser window doesn't stretch it.
	container: {
		flex: 1,
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
		gap: 24,
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	intro: {
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	// Only with no projects to list. Otherwise the intro keeps its own height:
	// on web, `flex: 0` would let it shrink to nothing.
	fill: {
		flex: 1,
	},
	actions: {
		gap: 12,
	},
	saveRecovery: {
		gap: 12,
		padding: 16,
		borderRadius: 12,
		backgroundColor: colors.surface,
	},
	saveRecoveryText: {
		fontSize: 14,
		lineHeight: 20,
		color: colors.textPrimary,
	},
	saveActions: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 8,
	},
	logoMark: {
		width: 56,
		height: 56,
		borderRadius: 16,
		backgroundColor: colors.accent,
		marginBottom: 12,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	subtitle: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 280,
		lineHeight: 21,
	},
});
