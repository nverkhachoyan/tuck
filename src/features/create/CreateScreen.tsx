import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBlankDocument } from "@/model/document";
import { editorHref } from "@/projects/projectRoute";
import { createBlankProject } from "@/projects/projectService";
import { useStore } from "@/store";
import {
	CHECKER_CELL,
	colors,
	radii,
	typography,
	webTransition,
} from "@/theme";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";
import { ScreenHeader } from "@/ui/ScreenHeader";

const PRESETS = [
	{ name: "Square", ratio: "1:1", width: 1080, height: 1080 },
	{ name: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
	{ name: "Story", ratio: "9:16", width: 1080, height: 1920 },
	{ name: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
] as const;
type Preset = (typeof PRESETS)[number];

const PREVIEW_SIZE = 88;

export default function CreateScreen() {
	const openDocument = useStore((state) => state.openDocument);
	const router = useRouter();
	const [background, setBackground] = useState<string | null>("#FFFFFF");
	const { bottom } = useSafeAreaInsets();
	const [busy, setBusy] = useState(false);
	// Set at once, so a second tap can't start another project meanwhile.
	const creating = useRef(false);

	const handleCreate = async ({ width, height }: Preset) => {
		// An editor whose save failed is still open until the welcome screen
		// closes it.
		if (creating.current || useStore.getState().document) return;
		creating.current = true;
		setBusy(true);
		try {
			// Without storage, the canvas can still be edited, just not kept.
			const opened = await createBlankProject({
				width,
				height,
				background,
			}).catch((error: unknown) => {
				console.warn("Couldn't save the canvas as a project", error);
				return {
					id: null,
					document: createBlankDocument(width, height, background),
				};
			});
			openDocument(opened.document, opened.id);
			router.replace(editorHref(opened.id));
		} finally {
			creating.current = false;
			setBusy(false);
		}
	};

	return (
		<View style={styles.screen}>
			<ScreenHeader
				title="New Canvas"
				onBack={() =>
					router.canGoBack() ? router.back() : router.replace("/")
				}
			/>
			<ScrollView
				contentContainerStyle={[styles.content, { paddingBottom: 24 + bottom }]}
			>
				<View style={styles.fill}>
					<View style={styles.fillText}>
						<Text style={styles.fillLabel}>Fill</Text>
						<Text style={styles.fillValue}>{fillName(background)}</Text>
					</View>
					<BackgroundPicker value={background} onPick={setBackground} />
				</View>
				<View style={styles.grid}>
					{PRESETS.map((preset) => (
						<PresetTile
							key={preset.name}
							preset={preset}
							background={background}
							disabled={busy}
							onPress={() => void handleCreate(preset)}
						/>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

function fillName(background: string | null) {
	if (background === null) return "Transparent";
	return background === "#000000" ? "Black" : "White";
}

function PresetTile({
	preset,
	background,
	disabled,
	onPress,
}: {
	preset: Preset;
	background: string | null;
	disabled: boolean;
	onPress: () => void;
}) {
	const { name, ratio, width, height } = preset;
	const scale = PREVIEW_SIZE / Math.max(width, height);
	const size = { width: width * scale, height: height * scale };
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${width} by ${height}`}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.tile,
					webTransition,
					hovered && styles.tileHovered,
					pressed && styles.tilePressed,
				];
			}}
		>
			{(state) => {
				const { hovered } = interaction(state);
				return (
					<>
						<Text style={styles.ratio}>{ratio}</Text>
						<View style={styles.previewArea}>
							<View
								style={[
									styles.preview,
									size,
									webTransition,
									background !== null && { backgroundColor: background },
									hovered && styles.previewLifted,
								]}
							>
								{background === null && (
									<CheckerFill {...size} cell={CHECKER_CELL} />
								)}
							</View>
						</View>
						<Text style={styles.name}>{name}</Text>
						<Text style={styles.size}>
							{width} × {height}
						</Text>
					</>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	// A phone-width column, like the welcome screen's.
	content: {
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
		gap: 16,
		padding: 24,
	},
	fill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: 16,
		paddingRight: 8,
		paddingVertical: 4,
		borderRadius: radii.medium,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	fillText: {
		gap: 1,
	},
	fillLabel: {
		...typography.bodyStrong,
		color: colors.textPrimary,
	},
	fillValue: {
		...typography.label,
		color: colors.textSecondary,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	tile: {
		flexBasis: "40%",
		flexGrow: 1,
		alignItems: "center",
		gap: 2,
		paddingTop: 20,
		paddingBottom: 16,
		paddingHorizontal: 12,
		borderRadius: radii.medium,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	tileHovered: {
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceHover,
	},
	tilePressed: {
		backgroundColor: colors.surfacePressed,
		transform: [{ scale: 0.98 }],
	},
	ratio: {
		...typography.caption,
		position: "absolute",
		top: 10,
		left: 12,
		fontVariant: ["tabular-nums"],
		color: colors.textTertiary,
	},
	previewArea: {
		width: PREVIEW_SIZE,
		height: PREVIEW_SIZE,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 12,
	},
	preview: {
		borderRadius: 3,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		overflow: "hidden",
		boxShadow: `0 4px 12px ${colors.shadow}`,
	},
	previewLifted: {
		transform: [{ translateY: -3 }],
		boxShadow: `0 10px 20px ${colors.shadow}`,
	},
	name: {
		...typography.bodyStrong,
		color: colors.textPrimary,
	},
	size: {
		...typography.label,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
});
