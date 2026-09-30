import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Canvas,
	Circle,
	RadialGradient,
	vec,
} from "@shopify/react-native-skia";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentProps, useEffect } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProjectList } from "@/features/home/ProjectList";
import {
	type HomeStatus,
	useHomeProjects,
} from "@/features/home/useHomeProjects";
import { usePhotoDrop } from "@/import/usePhotoDrop";
import { editorHref } from "@/projects/projectRoute";
import { useStore } from "@/store";
import {
	colors,
	fonts,
	radii,
	space,
	typography,
	webTransition,
} from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { gradientBackground } from "@/ui/gradient";
import { interaction } from "@/ui/interaction";
import { LogoMark } from "@/ui/LogoMark";

// Wide enough to be used with a mouse, where reach doesn't matter: the ways
// to start head the projects, as a web app's "new" actions usually do.
// Narrower, they sit at the bottom, under the thumb.
const START_ON_TOP_MIN_WIDTH = 1024;

const choosePhotoLabels: Record<HomeStatus, string> = {
	loading: "Loading…",
	saving: "Saving…",
	saveFailed: "Photo",
	opening: "Opening…",
	idle: "Photo",
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
	// A bar under the projects gives up less of the grid.
	const compact = hasProjects && !startOnTop;
	const start = (
		<View style={styles.start}>
			<StartTile
				label={choosePhotoLabels[status]}
				// The icon says what "Photo" does; a screen reader needs the verb.
				accessibilityLabel={blocked ? undefined : "Choose Photo"}
				compact={compact}
				icon="images-outline"
				primary
				disabled={blocked}
				onPress={choosePhoto}
			/>
			<StartTile
				label="Paste"
				compact={compact}
				icon="clipboard-outline"
				disabled={blocked}
				onPress={pasteImage}
			/>
			<StartTile
				label="New Canvas"
				compact={compact}
				icon="add"
				disabled={blocked}
				onPress={() => router.push("/create")}
			/>
		</View>
	);

	return (
		<View style={[styles.container, { paddingBottom: 24 + bottom }]}>
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
								<Glow />
								<LogoMark size={LOGO_SIZE} />
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

			{hasProjects && startOnTop && start}

			{hasProjects && (
				<View style={styles.projects}>
					<ProjectList
						projects={projects}
						disabled={blocked}
						onOpen={openProject}
						onRename={renameProject}
						onDuplicate={duplicateProject}
						onDelete={deleteProject}
					/>
					{/* The grid scrolls out of sight softly above the bar. */}
					{!startOnTop && <View style={styles.projectsFade} />}
				</View>
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
								onPress={() =>
									router.push(editorHref(useStore.getState().projectId))
								}
							/>
						</View>
					</View>
				</View>
			)}

			{hasProjects && !startOnTop && start}

			{!hasProjects && (
				<View style={styles.startArea}>
					{start}
					{Platform.OS === "web" && wide && (
						<Text style={styles.hint}>
							Or paste a screenshot, or drop an image anywhere.
						</Text>
					)}
				</View>
			)}
			{dragging && <DropOverlay label="Drop to open" />}
		</View>
	);
}

/** One way to start: an icon over its name, in a tile a third of the row. */
function StartTile({
	label,
	icon,
	accessibilityLabel = label,
	primary = false,
	compact,
	disabled,
	onPress,
}: {
	label: string;
	accessibilityLabel?: string;
	icon: ComponentProps<typeof Ionicons>["name"];
	primary?: boolean;
	compact: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled }}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.tile,
					compact && styles.tileCompact,
					primary && styles.tilePrimary,
					webTransition,
					hovered && (primary ? styles.tilePrimaryHovered : styles.tileHovered),
					pressed && styles.tilePressed,
					disabled && styles.tileDisabled,
				];
			}}
		>
			<Ionicons
				name={icon}
				size={24}
				color={primary ? colors.onAccent : colors.textPrimary}
			/>
			<Text
				style={[styles.tileLabel, primary && styles.tileLabelPrimary]}
				numberOfLines={1}
			>
				{label}
			</Text>
		</Pressable>
	);
}

const LOGO_SIZE = 96;
const GLOW_SIZE = 360;

/** A soft light in the accent's color, behind the logo it's centered on. */
function Glow() {
	const center = vec(GLOW_SIZE / 2, GLOW_SIZE / 2);
	return (
		<Animated.View entering={FadeIn.duration(1200)} style={styles.glow}>
			<Canvas style={styles.glowCanvas}>
				<Circle c={center} r={GLOW_SIZE / 2}>
					<RadialGradient
						c={center}
						r={GLOW_SIZE / 2}
						colors={["rgba(255, 107, 74, 0.16)", "rgba(255, 107, 74, 0)"]}
					/>
				</Circle>
			</Canvas>
		</Animated.View>
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
	glow: {
		position: "absolute",
		top: (LOGO_SIZE - GLOW_SIZE) / 2,
		left: (LOGO_SIZE - GLOW_SIZE) / 2,
		pointerEvents: "none",
	},
	glowCanvas: {
		width: GLOW_SIZE,
		height: GLOW_SIZE,
	},
	wordmark: {
		marginTop: 18,
		fontFamily: fonts.displayItalic,
		fontSize: 64,
		lineHeight: 70,
		color: colors.textPrimary,
	},
	tagline: {
		...typography.body,
		lineHeight: 22,
		color: colors.textSecondary,
		textAlign: "center",
	},
	projects: {
		flex: 1,
	},
	projectsFade: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: space.lg,
		pointerEvents: "none",
		...gradientBackground(
			"linear-gradient(to bottom, rgba(10, 10, 11, 0), rgba(10, 10, 11, 1))",
		),
	},
	startArea: {
		gap: 14,
	},
	start: {
		flexDirection: "row",
		gap: space.xs,
	},
	tile: {
		flex: 1,
		height: 80,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingHorizontal: space.xs,
		borderRadius: radii.medium,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	tileCompact: {
		height: 64,
	},
	tilePrimary: {
		borderColor: colors.accent,
		backgroundColor: colors.accent,
	},
	tileHovered: {
		backgroundColor: colors.surfaceHover,
	},
	tilePrimaryHovered: {
		backgroundColor: colors.accentHover,
	},
	tilePressed: {
		transform: [{ scale: 0.97 }],
	},
	tileDisabled: {
		opacity: 0.5,
	},
	tileLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	tileLabelPrimary: {
		color: colors.onAccent,
	},
	hint: {
		...typography.label,
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
