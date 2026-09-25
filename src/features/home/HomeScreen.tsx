import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Canvas,
	Circle,
	RadialGradient,
	vec,
} from "@shopify/react-native-skia";
import { useIsFocused, useRouter } from "expo-router";
import {
	Platform,
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
import { colors, fonts, radii } from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { LogoMark } from "@/ui/LogoMark";

const choosePhotoLabels: Record<HomeStatus, string> = {
	loading: "Loading…",
	saving: "Saving…",
	saveFailed: "Choose Photo",
	opening: "Opening…",
	idle: "Choose Photo",
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
		openProject,
		deleteProject,
	} = useHomeProjects();
	// Side by side once there's room for both labels.
	const wide = useWindowDimensions().width >= 560;
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

	const hasProjects = projects.length > 0;
	const blocked = status !== "idle";

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

			{hasProjects && (
				<ProjectList
					projects={projects}
					disabled={blocked}
					onOpen={openProject}
					onDelete={deleteProject}
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
								onPress={() =>
									router.push(editorHref(useStore.getState().projectId))
								}
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
							onPress={choosePhoto}
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
