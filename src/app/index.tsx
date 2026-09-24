import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { renderThumbnail } from "@/export/renderDocument";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/import/pickPhoto";
import { usePhotoDrop } from "@/import/usePhotoDrop";
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
import { colors, fonts, radii } from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { LogoMark } from "@/ui/LogoMark";

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
	// Whether the list has loaded once, so its empty state can show.
	const [listed, setListed] = useState(false);
	// Side by side once there's room for both labels.
	const wide = useWindowDimensions().width >= 560;
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
			const { uri, width, height } = photo;
			return {
				id: null,
				document: createDocumentFromImage(uri, width, height),
			};
		});

	const handleChoosePhoto = () =>
		open("Couldn't open photo", async () => {
			const result = await pickPhoto();
			if (result.status === "canceled") return null;
			return openPhoto(result.photo);
		});

	// On web, an image pasted or dropped here opens like a chosen one. Only
	// while this screen is in front: it stays mounted under the editor.
	const focused = useIsFocused();
	const { dragging } = usePhotoDrop({
		enabled: focused && status === "idle",
		onPhoto: async (uri) => {
			await open("Couldn't open image", async () =>
				openPhoto(await importPhoto(uri)),
			);
		},
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
			{hasProjects ? (
				<Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
					<LogoMark size={34} />
					<Text style={styles.brandName}>Tuck</Text>
				</Animated.View>
			) : (
				<View style={styles.hero}>
					{/* Only once the list is known to be empty, so a returning
						user's projects don't replace a flash of it. */}
					{listed && (
						<>
							<Animated.View entering={FadeInDown.duration(500)}>
								<LogoMark size={96} />
							</Animated.View>
							<Animated.Text
								entering={FadeInDown.delay(80).duration(500)}
								style={styles.wordmark}
							>
								Tuck
							</Animated.Text>
							<Animated.Text
								entering={FadeInDown.delay(160).duration(500)}
								style={styles.tagline}
							>
								The last touch for photos and screenshots.{"\n"}No account, no
								waiting.
							</Animated.Text>
						</>
					)}
				</View>
			)}

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
					<Ionicons name="warning-outline" size={20} color={colors.accent} />
					<View style={styles.saveRecoveryBody}>
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
				</View>
			)}

			<View style={styles.actionsArea}>
				<View style={[styles.actions, wide && styles.actionsWide]}>
					<View style={wide && styles.flex}>
						<Button
							label={choosePhotoLabels[status]}
							icon="images-outline"
							variant="primary"
							size="large"
							disabled={blocked}
							onPress={handleChoosePhoto}
						/>
					</View>
					<View style={wide && styles.flex}>
						<Button
							label="New Canvas"
							icon="add"
							size="large"
							disabled={blocked}
							onPress={() => router.push("/create")}
						/>
					</View>
				</View>
				{Platform.OS === "web" && wide && (
					<Text style={styles.hint}>
						Or paste a screenshot, or drop an image anywhere.
					</Text>
				)}
			</View>
			{dragging && <DropOverlay label="Drop to open" />}
		</View>
	);
}

const styles = StyleSheet.create({
	// A phone-width column, or a little wider for the grid, so a wide browser
	// window doesn't stretch it.
	container: {
		flex: 1,
		width: "100%",
		maxWidth: 760,
		alignSelf: "center",
		gap: 24,
		paddingHorizontal: 24,
		paddingTop: 20,
		paddingBottom: 24,
	},
	flex: {
		flex: 1,
	},
	brand: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	brandName: {
		fontFamily: fonts.displayItalic,
		fontSize: 34,
		color: colors.textPrimary,
	},
	hero: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	wordmark: {
		marginTop: 18,
		fontFamily: fonts.displayItalic,
		fontSize: 64,
		lineHeight: 70,
		color: colors.textPrimary,
	},
	tagline: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.textSecondary,
		textAlign: "center",
	},
	actionsArea: {
		gap: 14,
	},
	actions: {
		gap: 12,
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
	},
	actionsWide: {
		flexDirection: "row",
		maxWidth: 560,
	},
	hint: {
		fontSize: 13,
		color: colors.textTertiary,
		textAlign: "center",
	},
	saveRecovery: {
		flexDirection: "row",
		gap: 12,
		padding: 16,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: colors.accentSoft,
		backgroundColor: colors.surface,
	},
	saveRecoveryBody: {
		flex: 1,
		gap: 12,
	},
	saveRecoveryText: {
		fontSize: 14,
		lineHeight: 20,
		color: colors.textPrimary,
	},
	saveActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
});
