import Ionicons from "@expo/vector-icons/Ionicons";
import {
	useFocusEffect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HOME_MAX_WIDTH, ProjectList } from "@/features/home/ProjectList";
import {
	type HomeStatus,
	useHomeProjects,
} from "@/features/home/useHomeProjects";
import { usePhotoDrop } from "@/import/usePhotoDrop";
import { editorHref } from "@/projects/projectRoute";
import { useStore } from "@/store";
import { colors, fonts, radii, space, typography } from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { Highlight } from "@/ui/Highlight";
import { TextButton } from "@/ui/TextButton";

// Wide enough to be used with a mouse, where reach doesn't matter: the ways
// to start head the projects, as a web app's "new" actions usually do.
// Narrower, they sit at the bottom, under the thumb.
const START_ON_TOP_MIN_WIDTH = 1024;

const openPhotoLabels: Record<HomeStatus, string> = {
	loading: "Loading…",
	saving: "Saving…",
	saveFailed: "Open a photo",
	opening: "Opening…",
	idle: "Open a photo",
};

export default function HomeScreen() {
	const router = useRouter();
	const {
		status,
		projects,
		listed,
		finishSession,
		choosePhoto,
		openImage,
		openSharedPhoto,
		pasteImage,
		openProject,
		renameProject,
		duplicateProject,
		deleteProject,
	} = useHomeProjects();
	const { width } = useWindowDimensions();
	// Room for the hint about pasting and dropping.
	const wide = width >= 560;
	const startOnTop = width >= START_ON_TOP_MIN_WIDTH;
	const { bottom } = useSafeAreaInsets();

	// On web, an image pasted or dropped here opens like a chosen one. Only
	// while this screen is in front: it stays mounted under the editor.
	const focused = useIsFocused();
	const { dragging } = usePhotoDrop({
		enabled: focused && status === "idle",
		onPhoto: async (uri) => {
			await openImage(uri);
		},
	});

	// A photo shared from another app opens once the editor's session has
	// ended: coming back from the editor, this screen is idle for a render
	// before it starts saving. The param goes at once, so it opens only once.
	const { shared } = useLocalSearchParams<{ shared?: string }>();
	const sessionOpen = useStore((state) => state.document !== null);
	useEffect(() => {
		if (!shared || !focused || status !== "idle" || sessionOpen) return;
		router.setParams({ shared: undefined });
		void openSharedPhoto(shared);
	}, [shared, focused, status, sessionOpen, router, openSharedPhoto]);

	const hasProjects = projects.length > 0;
	const blocked = status !== "idle";
	// Editing names, which leaving the screen ends.
	const [editing, setEditing] = useState(false);
	useFocusEffect(useCallback(() => () => setEditing(false), []));

	const start = (
		<View style={[styles.start, startOnTop && styles.startRow]}>
			<View style={startOnTop && styles.startShare}>
				<Button
					label={openPhotoLabels[status]}
					// The label changes while busy; a screen reader needs the verb.
					accessibilityLabel={blocked ? undefined : "Open a photo"}
					icon="images-outline"
					variant="primary"
					size={startOnTop ? "medium" : "large"}
					disabled={blocked}
					onPress={choosePhoto}
				/>
			</View>
			<View style={[styles.startSecondary, startOnTop && styles.startShare]}>
				<View style={styles.flex}>
					<Button
						label="Paste"
						icon="clipboard-outline"
						disabled={blocked}
						onPress={pasteImage}
					/>
				</View>
				<View style={styles.flex}>
					<Button
						label="Blank canvas"
						icon="add"
						disabled={blocked}
						onPress={() => router.push("/create")}
					/>
				</View>
			</View>
		</View>
	);

	return (
		<View
			style={[
				styles.screen,
				hasProjects && listed && styles.screenWithProjects,
			]}
		>
			{hasProjects ? (
				<View style={styles.header}>
					<View style={[styles.column, styles.headerColumn]}>
						<View style={styles.headerRow}>
							<Wordmark size={34} />
							<TextButton
								label={editing ? "Done" : "Edit"}
								tone={editing ? "strong" : "default"}
								onPress={() => setEditing((on) => !on)}
							/>
						</View>
						{startOnTop && start}
					</View>
				</View>
			) : (
				<View style={styles.hero}>
					{/* Only once the list is known to be empty, so a returning
						user's projects don't replace a flash of it. */}
					{listed && (
						<>
							<Wordmark size={72} />
							<Animated.Text
								entering={FadeIn.delay(160).duration(400)}
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
					editing={editing}
					disabled={blocked}
					onOpen={openProject}
					onRename={renameProject}
					onDuplicate={duplicateProject}
					onDelete={deleteProject}
					onStartEditing={() => setEditing(true)}
				/>
			)}

			{status === "saveFailed" && (
				<View style={[styles.column, styles.saveRecoveryArea]}>
					<View style={styles.saveRecovery}>
						<Ionicons name="warning-outline" size={20} color={colors.danger} />
						<View style={styles.saveRecoveryBody}>
							<Text style={styles.saveRecoveryText}>
								Your edits are still open. Retry saving or return to the editor.
							</Text>
							<View style={styles.saveActions}>
								<Button label="Retry Save" onPress={finishSession} />
								<Button
									label="Return to Editor"
									onPress={() =>
										router.push(editorHref(useStore.getState().projectId))
									}
								/>
							</View>
						</View>
					</View>
				</View>
			)}

			{!(hasProjects && startOnTop) && (
				<View
					style={[
						styles.bottomBar,
						hasProjects && styles.bottomBarOverProjects,
						{ paddingBottom: space.md + bottom },
					]}
				>
					<View style={[styles.column, styles.bottomColumn]}>
						{start}
						{!hasProjects && Platform.OS === "web" && wide && (
							<Text style={styles.hint}>
								Or paste a screenshot, or drop an image anywhere.
							</Text>
						)}
					</View>
				</View>
			)}
			{dragging && <DropOverlay label="Drop to open" />}
		</View>
	);
}

/**
 * "Tuck" in Anton, the captions' typeface, in black on a highlighter swipe:
 * one mark that reads on paper and on the night palette's graphite, and
 * matches the app icon. It swipes in as it appears.
 */
function Wordmark({ size }: { size: number }) {
	return (
		<View accessibilityRole="header">
			<Highlight
				style={{
					top: size * 0.16,
					bottom: size * 0.06,
					left: -size * 0.12,
					right: -size * 0.16,
				}}
			/>
			<Text
				style={[
					styles.wordmarkText,
					{ fontSize: size, lineHeight: size * 1.2 },
				]}
			>
				Tuck
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	// Paper, or with projects, the table they lie on between the bars.
	screen: {
		flex: 1,
		backgroundColor: colors.background,
	},
	screenWithProjects: {
		backgroundColor: colors.canvasWell,
	},
	flex: {
		flex: 1,
	},
	column: {
		width: "100%",
		maxWidth: HOME_MAX_WIDTH,
		alignSelf: "center",
		paddingHorizontal: space.md,
	},
	header: {
		backgroundColor: colors.background,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	headerColumn: {
		gap: space.md,
		paddingTop: space.xs,
		paddingBottom: space.md,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	wordmarkText: {
		fontFamily: fonts.display,
		color: colors.onHighlight,
	},
	hero: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
		paddingHorizontal: space.lg,
	},
	tagline: {
		...typography.body,
		lineHeight: 22,
		color: colors.textSecondary,
		textAlign: "center",
	},
	bottomBar: {
		backgroundColor: colors.background,
		paddingTop: space.md,
	},
	bottomBarOverProjects: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	bottomColumn: {
		gap: space.sm,
	},
	// Stacked under the thumb: the photo first, the other ways under it. In a
	// row across a wide screen's header.
	start: {
		gap: space.xs,
	},
	startRow: {
		flexDirection: "row",
	},
	// Half the row each, in a row only: in a column, a flex child would
	// collapse to nothing on native.
	startShare: {
		flex: 1,
	},
	startSecondary: {
		flexDirection: "row",
		gap: space.xs,
	},
	hint: {
		...typography.label,
		color: colors.textTertiary,
		textAlign: "center",
	},
	saveRecoveryArea: {
		paddingVertical: space.sm,
	},
	saveRecovery: {
		flexDirection: "row",
		gap: 12,
		padding: 16,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	saveRecoveryBody: {
		flex: 1,
		gap: 12,
	},
	saveRecoveryText: {
		...typography.label,
		lineHeight: 18,
		color: colors.textPrimary,
	},
	saveActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
});
