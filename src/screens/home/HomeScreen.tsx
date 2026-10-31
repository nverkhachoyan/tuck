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
import { getSession, useSession } from "@/editor";
import { listenForLaunchedPhotos } from "@/photos/sharedPhoto";
import { useUpdateReady } from "@/platform/serviceWorker";
import { usePhotoDrop } from "@/platform/usePhotoDrop";
import { editorHref } from "@/projects/projectRoute";
import { PageHead } from "@/site/PageHead";
import { Announcement } from "@/ui/Announcement";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { compactControls } from "@/ui/density";
import { Highlight } from "@/ui/Highlight";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { TextButton } from "@/ui/TextButton";
import {
	colors,
	fonts,
	HEADER_HEIGHT,
	radii,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import { HOME_MAX_WIDTH, ProjectList } from "./ProjectList";
import {
	type HomeBusyAction,
	type HomeStatus,
	useHomeProjects,
} from "./useHomeProjects";

// Wide enough to be used with a mouse, where reach doesn't matter: the ways
// to start head the projects, or sit with the wordmark when there are none.
// Narrower, they sit at the bottom, under the thumb.
const START_ON_TOP_MIN_WIDTH = 1024;
// Matches the editor dock's max width so bottom-bar buttons don't stretch
// across a tablet or medium window.
const BOTTOM_BAR_MAX_WIDTH = 520;

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

export default function HomeScreen() {
	const router = useRouter();
	const {
		status,
		busyAction,
		openingProjectId,
		announcement,
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
	// Empty-only chrome waits until `listed` so returning users don't see a
	// flash of hero actions or footer links before their projects mount.
	const showEmpty = !hasProjects && (listed || prerendering);
	const blocked = status !== "idle";
	// Editing names, which leaving the screen ends.
	const [editing, setEditing] = useState(false);
	const [scrollTopKey, setScrollTopKey] = useState(0);
	useFocusEffect(useCallback(() => () => setEditing(false), []));

	const handleDuplicate = async (id: string) => {
		if (await duplicateProject(id)) {
			setScrollTopKey((count) => count + 1);
		}
	};

	const start = (
		<StartActions
			busyAction={busyAction}
			blocked={blocked}
			row={startOnTop}
			inHeader={startOnTop && hasProjects}
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
			<Announcement message={announcement} />

			{hasProjects ? (
				<HomeHeader
					editing={editing}
					onToggleEditing={() => setEditing((on) => !on)}
					onSettings={() => router.push("/settings")}
				>
					{startOnTop && start}
				</HomeHeader>
			) : (
				showEmpty && (
					<View style={styles.emptyHeader}>
						<View style={[styles.column, styles.emptyHeaderRow]}>
							<IconButton
								icon="settings-outline"
								label="Settings"
								onPress={() => router.push("/settings")}
							/>
						</View>
					</View>
				)
			)}

			{status === "saveFailed" && (
				<Notice
					icon="warning-outline"
					color={colors.danger}
					urgent
					message="Your edits are still open. Retry saving or return to the editor."
				>
					<Button label="Retry save" onPress={finishSession} />
					<Button
						label="Return to editor"
						onPress={() => router.push(editorHref(getSession().key))}
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

			{hasProjects ? (
				<ProjectList
					projects={projects}
					editing={editing}
					disabled={blocked}
					openingProjectId={openingProjectId}
					scrollTopKey={scrollTopKey}
					bottomInset={startOnTop ? bottom : 0}
					onOpen={openProject}
					onRename={renameProject}
					onDuplicate={handleDuplicate}
					onDelete={deleteProject}
					footer={<AboutLinks />}
				/>
			) : (
				<HomeHero showWordmark={showEmpty}>
					{startOnTop && showEmpty && (
						<View style={styles.heroActions}>
							{start}
							{Platform.OS === "web" && <PasteHint />}
							<AboutLinks />
						</View>
					)}
				</HomeHero>
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
						{showEmpty && Platform.OS === "web" && wide && <PasteHint />}
						{showEmpty && <AboutLinks />}
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
	const sessionOpen = useSession((session) => session.document !== null);
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
 * - `row`: side by side on a wide screen, rather than stacked in the bottom bar.
 * - `inHeader`: inline beside the wordmark over projects, using small pills on mouse pointers.
 */
function StartActions({
	busyAction,
	blocked,
	row,
	inHeader,
	onChoosePhoto,
	onPaste,
	onBlankCanvas,
}: {
	busyAction: HomeBusyAction;
	blocked: boolean;
	row: boolean;
	inHeader: boolean;
	onChoosePhoto: () => void;
	onPaste: () => void;
	onBlankCanvas: () => void;
}) {
	const slot = row ? undefined : styles.flex;
	const secondarySize = inHeader && compactControls ? "small" : "medium";
	const primarySize = inHeader ? secondarySize : row ? "medium" : "large";
	return (
		<View
			style={[
				styles.start,
				row && styles.startRow,
				inHeader && styles.startInHeader,
			]}
		>
			<Button
				label="Open a photo"
				icon="images-outline"
				variant="primary"
				size={primarySize}
				busy={busyAction === "choose"}
				disabled={blocked}
				onPress={onChoosePhoto}
			/>
			<View style={styles.startSecondary}>
				<View style={slot}>
					<Button
						label="Paste"
						icon="clipboard-outline"
						size={secondarySize}
						shortcut="mod+V"
						busy={busyAction === "paste"}
						disabled={blocked}
						onPress={onPaste}
					/>
				</View>
				<View style={slot}>
					<Button
						label="Blank canvas"
						icon="add"
						size={secondarySize}
						disabled={blocked}
						onPress={onBlankCanvas}
					/>
				</View>
			</View>
		</View>
	);
}

/** Home's header over its projects: the wordmark, start actions on wide screens, Edit, and Settings. */
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
			<View style={[styles.column, styles.headerRow]}>
				<View style={styles.headerStart}>
					<Wordmark size={34} />
					{children}
				</View>
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
	urgent = false,
	message,
	children,
}: {
	icon: ComponentProps<typeof Ionicons>["name"];
	color: string;
	urgent?: boolean;
	message: string;
	children: ReactNode;
}) {
	return (
		<View
			role={urgent ? "alert" : "status"}
			accessibilityLiveRegion={urgent ? "assertive" : "polite"}
			style={[styles.column, styles.noticeArea]}
		>
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

function AboutLinks() {
	return (
		<View
			role="navigation"
			accessibilityLabel="About Tuck"
			style={styles.aboutLinks}
		>
			{ABOUT_PAGES.map(({ label, href }) => (
				// An anchor on web. Its slot replaces the Pressable's style, so the
				// look that follows hover and press is on a view inside.
				<Link key={href} href={href} asChild>
					<Pressable hitSlop={6}>
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
	headerRow: {
		minHeight: HEADER_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingVertical: space.xs,
	},
	headerStart: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.lg,
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	emptyHeader: {
		backgroundColor: colors.background,
	},
	emptyHeaderRow: {
		minHeight: HEADER_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		paddingVertical: space.xs,
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
		maxWidth: BOTTOM_BAR_MAX_WIDTH,
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
	// row across a wide screen, centered on an empty home or inline in the
	// header beside the wordmark when projects exist.
	start: {
		gap: space.xs,
	},
	startRow: {
		flexDirection: "row",
		alignItems: "center",
		maxWidth: 640,
		alignSelf: "center",
	},
	startInHeader: {
		alignSelf: "auto",
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
		minHeight: compactControls ? 28 : 36,
		justifyContent: "center",
		paddingHorizontal: space.xs,
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
		paddingTop: space.sm,
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
