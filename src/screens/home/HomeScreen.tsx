import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Link,
	useFocusEffect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listenForLaunchedPhotos } from "@/photos/sharedPhoto";
import { usePhotoDrop } from "@/photos/usePhotoDrop";
import { useUpdateReady } from "@/platform/serviceWorker";
import { editorHref } from "@/projects/projectRoute";
import { useStore } from "@/store";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { Highlight } from "@/ui/Highlight";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { PageHead } from "@/ui/PageHead";
import { TextButton } from "@/ui/TextButton";
import {
	colors,
	fonts,
	radii,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import { HOME_MAX_WIDTH, ProjectList } from "./ProjectList";
import { type HomeStatus, useHomeProjects } from "./useHomeProjects";

// Wide enough to be used with a mouse, where reach doesn't matter: the ways
// to start head the projects, as a web app's "new" actions usually do.
// Narrower, they sit at the bottom, under the thumb.
const START_ON_TOP_MIN_WIDTH = 1024;

// The pages the app stores link to, which belong in the app too.
const ABOUT_PAGES = [
	{ label: "Support", href: "/support" },
	{ label: "Privacy", href: "/privacy" },
	{ label: "Licenses", href: "/licenses" },
] as const;

// The web export renders the page ahead of time, where there are no
// projects to list, and its HTML is all a search engine or a slow connection
// sees, so that render always shows the hero. (`window` is defined on native.)
const prerendering = Platform.OS === "web" && typeof window === "undefined";

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
	const applyUpdate = useUpdateReady();
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
	// On web, a photo the installed app is opened with ("Open with" on the
	// desktop) comes the same way. Each opens its own window, at home.
	useEffect(
		() => listenForLaunchedPhotos((name) => router.setParams({ shared: name })),
		[router],
	);

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
			role="main"
			style={[
				styles.screen,
				hasProjects && listed && styles.screenWithProjects,
			]}
		>
			<PageHead path="/" />
			{hasProjects ? (
				<View style={styles.header}>
					<View style={[styles.column, styles.headerColumn]}>
						<View style={styles.headerRow}>
							<Wordmark size={34} />
							<View style={styles.headerActions}>
								<TextButton
									label={editing ? "Done" : "Edit"}
									tone={editing ? "strong" : "default"}
									onPress={() => setEditing((on) => !on)}
								/>
								<IconButton
									icon="settings-outline"
									label="Settings"
									onPress={() => router.push("/settings")}
								/>
							</View>
						</View>
						{startOnTop && start}
					</View>
				</View>
			) : (
				<View style={styles.hero}>
					{/* In the app, only once the list is known to be empty, so a
						returning user's projects don't replace a flash of it. */}
					{(listed || prerendering) && (
						<>
							<Wordmark size={72} />
							<Animated.Text
								// Reanimated hides a view until it enters.
								entering={
									prerendering ? undefined : FadeIn.delay(160).duration(400)
								}
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
					footer={<AboutLinks />}
				/>
			)}

			{status === "saveFailed" && (
				<View style={[styles.column, styles.noticeArea]}>
					<View style={styles.notice}>
						<Ionicons name="warning-outline" size={20} color={colors.danger} />
						<View style={styles.noticeBody}>
							<Text style={styles.noticeText}>
								Your edits are still open. Retry saving or return to the editor.
							</Text>
							<View style={styles.noticeActions}>
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

			{applyUpdate && (
				<View style={[styles.column, styles.noticeArea]}>
					<View style={styles.notice}>
						<Ionicons
							name="arrow-up-circle-outline"
							size={20}
							color={colors.textPrimary}
						/>
						<View style={styles.noticeBody}>
							<Text style={styles.noticeText}>
								A new version of Tuck is ready.
							</Text>
							<View style={styles.noticeActions}>
								<Button label="Reload" onPress={applyUpdate} />
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
						{!hasProjects && <AboutLinks withSettings />}
					</View>
				</View>
			)}
			{dragging && <DropOverlay label="Drop to open" />}
		</View>
	);
}

/**
 * With `withSettings`, links to Settings too: without projects, there's no
 * header to hold its gear.
 */
function AboutLinks({ withSettings = false }: { withSettings?: boolean }) {
	const pages = withSettings
		? [{ label: "Settings", href: "/settings" } as const, ...ABOUT_PAGES]
		: ABOUT_PAGES;
	return (
		<View
			role="navigation"
			accessibilityLabel="About Tuck"
			style={styles.aboutLinks}
		>
			{pages.map(({ label, href }) => (
				// An anchor on web. Its slot replaces the Pressable's style, so the
				// look that follows hover and press is on a view inside.
				<Link key={href} href={href} asChild>
					<Pressable hitSlop={8}>
						{(state) => {
							const { pressed, hovered } = interaction(state);
							return (
								<View
									style={[
										styles.aboutLink,
										webTransition,
										hovered && styles.aboutLinkHovered,
										pressed && styles.aboutLinkPressed,
									]}
								>
									<Text style={styles.aboutLinkLabel}>{label}</Text>
								</View>
							);
						}}
					</Pressable>
				</Link>
			))}
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
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
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
		color: colors.textSecondary,
		textAlign: "center",
	},
	aboutLinks: {
		flexDirection: "row",
		justifyContent: "center",
		gap: space.xs,
	},
	aboutLink: {
		paddingHorizontal: space.xs,
		paddingVertical: space.xxs,
		borderRadius: radii.small,
	},
	aboutLinkHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	aboutLinkPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	aboutLinkLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	noticeArea: {
		paddingVertical: space.sm,
	},
	notice: {
		flexDirection: "row",
		gap: 12,
		padding: 16,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	noticeBody: {
		flex: 1,
		gap: 12,
	},
	noticeText: {
		...typography.label,
		lineHeight: 18,
		color: colors.textPrimary,
	},
	noticeActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
});
