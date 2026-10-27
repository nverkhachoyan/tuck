import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Link,
	useFocusEffect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";
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
// to start head the projects, or sit with the wordmark when there are none.
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

	useSharedPhotos({ focused, status, openSharedPhoto });

	const hasProjects = projects.length > 0;
	const blocked = status !== "idle";
	// Editing names, which leaving the screen ends.
	const [editing, setEditing] = useState(false);
	useFocusEffect(useCallback(() => () => setEditing(false), []));

	const start = (
		<StartActions
			status={status}
			row={startOnTop}
			aligned={startOnTop && hasProjects}
			onChoosePhoto={choosePhoto}
			onPaste={pasteImage}
			onBlankCanvas={() => router.push("/create")}
		/>
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
				<HomeHeader
					editing={editing}
					onToggleEditing={() => setEditing((on) => !on)}
					onSettings={() => router.push("/settings")}
				>
					{startOnTop && start}
				</HomeHeader>
			) : (
				<HomeHero showWordmark={listed || prerendering}>
					{startOnTop && (
						<View style={styles.heroActions}>
							{start}
							{Platform.OS === "web" && <PasteHint />}
							<AboutLinks withSettings />
						</View>
					)}
				</HomeHero>
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
				<Notice
					icon="warning-outline"
					color={colors.danger}
					message="Your edits are still open. Retry saving or return to the editor."
				>
					<Button label="Retry save" onPress={finishSession} />
					<Button
						label="Return to editor"
						onPress={() =>
							router.push(editorHref(useStore.getState().projectId))
						}
					/>
				</Notice>
			)}

			{applyUpdate && (
				<Notice
					icon="arrow-up-circle-outline"
					color={colors.textPrimary}
					message="A new version of Tuck is ready."
				>
					<Button label="Reload" onPress={applyUpdate} />
				</Notice>
			)}

			{!startOnTop && (
				<View
					style={[
						styles.bottomBar,
						hasProjects && styles.bottomBarOverProjects,
						{ paddingBottom: space.md + bottom },
					]}
				>
					<View style={[styles.column, styles.bottomColumn]}>
						{start}
						{!hasProjects && Platform.OS === "web" && wide && <PasteHint />}
						{!hasProjects && <AboutLinks withSettings />}
					</View>
				</View>
			)}
			{dragging && <DropOverlay label="Drop to open" />}
		</View>
	);
}

/**
 * Opens a photo shared from another app, which arrives as home's `shared`
 * param, once the editor's session has ended: coming back from the editor,
 * this screen is idle for a render before it starts saving. The param goes
 * at once, so it opens only once. On web, a photo the installed app is
 * opened with ("Open with" on the desktop) comes the same way; each opens
 * its own window, at home.
 */
function useSharedPhotos({
	focused,
	status,
	openSharedPhoto,
}: {
	focused: boolean;
	status: HomeStatus;
	openSharedPhoto: (name: string) => void;
}) {
	const router = useRouter();
	const { shared } = useLocalSearchParams<{ shared?: string }>();
	const sessionOpen = useStore((state) => state.document !== null);
	useEffect(() => {
		if (!shared || !focused || status !== "idle" || sessionOpen) return;
		router.setParams({ shared: undefined });
		void openSharedPhoto(shared);
	}, [shared, focused, status, sessionOpen, router, openSharedPhoto]);
	useEffect(
		() => listenForLaunchedPhotos((name) => router.setParams({ shared: name })),
		[router],
	);
}

/**
 * The ways to start a project: open a photo, paste one, or a blank canvas.
 * - `row`: side by side, at the top of a wide screen, rather than stacked in
 *   the bottom bar, the secondary two sharing a row under the first.
 * - `aligned`: with projects, the row shares the column's left edge with the
 *   wordmark and the prints. On an empty home it stays centered under the
 *   wordmark.
 */
function StartActions({
	status,
	row,
	aligned,
	onChoosePhoto,
	onPaste,
	onBlankCanvas,
}: {
	status: HomeStatus;
	row: boolean;
	aligned: boolean;
	onChoosePhoto: () => void;
	onPaste: () => void;
	onBlankCanvas: () => void;
}) {
	const blocked = status !== "idle";
	const slot = row ? undefined : styles.flex;
	return (
		<View
			style={[
				styles.start,
				row && styles.startRow,
				aligned && styles.startAligned,
			]}
		>
			<Button
				label={openPhotoLabels[status]}
				// The label changes while busy; a screen reader needs the verb.
				accessibilityLabel={blocked ? undefined : "Open a photo"}
				icon="images-outline"
				variant="primary"
				size={row ? "medium" : "large"}
				disabled={blocked}
				onPress={onChoosePhoto}
			/>
			<View style={styles.startSecondary}>
				<View style={slot}>
					<Button
						label="Paste"
						icon="clipboard-outline"
						disabled={blocked}
						onPress={onPaste}
					/>
				</View>
				<View style={slot}>
					<Button
						label="Blank canvas"
						icon="add"
						disabled={blocked}
						onPress={onBlankCanvas}
					/>
				</View>
			</View>
		</View>
	);
}

/** Home's header over its projects: the wordmark, Edit, and Settings. */
function HomeHeader({
	editing,
	onToggleEditing,
	onSettings,
	children,
}: {
	editing: boolean;
	onToggleEditing: () => void;
	onSettings: () => void;
	children: ReactNode;
}) {
	return (
		<View style={styles.header}>
			<View style={[styles.column, styles.headerColumn]}>
				<View style={styles.headerRow}>
					<Wordmark size={34} />
					<View style={styles.headerActions}>
						<TextButton
							label={editing ? "Done" : "Edit"}
							tone={editing ? "strong" : "default"}
							onPress={onToggleEditing}
						/>
						<IconButton
							icon="settings-outline"
							label="Settings"
							onPress={onSettings}
						/>
					</View>
				</View>
				{children}
			</View>
		</View>
	);
}

/**
 * An empty home's hero: the wordmark and the tagline, once `showWordmark`.
 * In the app, that's once the list is known to be empty, so a returning
 * user's projects don't replace a flash of it.
 */
function HomeHero({
	showWordmark,
	children,
}: {
	showWordmark: boolean;
	children: ReactNode;
}) {
	return (
		<View style={styles.hero}>
			{showWordmark && (
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
			{children}
		</View>
	);
}

function PasteHint() {
	return (
		<Text style={styles.hint}>
			Or paste a screenshot, or drop an image anywhere.
		</Text>
	);
}

/** A notice across the column: an icon, a message, and its buttons. */
function Notice({
	icon,
	color,
	message,
	children,
}: {
	icon: ComponentProps<typeof Ionicons>["name"];
	color: string;
	message: string;
	children: ReactNode;
}) {
	return (
		<View style={[styles.column, styles.noticeArea]}>
			<View style={styles.notice}>
				<Ionicons name={icon} size={20} color={color} />
				<View style={styles.noticeBody}>
					<Text style={styles.noticeText}>{message}</Text>
					<View style={styles.noticeActions}>{children}</View>
				</View>
			</View>
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
	// With the wordmark on a wide empty home: the actions, the hint, the links.
	heroActions: {
		width: "100%",
		maxWidth: 640,
		alignSelf: "center",
		gap: space.sm,
		marginTop: space.lg,
	},
	// Stacked under the thumb: the photo first, the other ways under it. In a
	// row across a wide screen, held to a comfortable width so the buttons
	// don't stretch across a laptop. Centered on an empty home; with projects,
	// lined up with the wordmark.
	start: {
		gap: space.xs,
	},
	startRow: {
		flexDirection: "row",
		maxWidth: 640,
		alignSelf: "center",
	},
	startAligned: {
		alignSelf: "flex-start",
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
		color: colors.textPrimary,
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
