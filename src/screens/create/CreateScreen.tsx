import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBlankDocument } from "@/model/document";
import type { Size } from "@/model/geometry";
import { usePreference } from "@/platform/usePreference";
import { editorHref } from "@/projects/projectRoute";
import { createBlankProject } from "@/projects/projectService";
import { useStore } from "@/store";
import { Announcement } from "@/ui/Announcement";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { Button } from "@/ui/Button";
import { CheckerFill } from "@/ui/CheckerFill";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { ScreenHeader } from "@/ui/ScreenHeader";
import {
	CHECKER_CELL,
	colors,
	radii,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import {
	checkCanvasSize,
	MAX_CANVAS_SIDE,
	MIN_CANVAS_SIDE,
	parseCustomSize,
} from "./canvasSize";

const PRESETS = [
	{ name: "Square", ratio: "1:1", width: 1080, height: 1080 },
	{ name: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
	{ name: "Story", ratio: "9:16", width: 1080, height: 1920 },
	{ name: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
] as const;
type Preset = (typeof PRESETS)[number];

const PREVIEW_SIZE = 88;
const SIDE_HEIGHT = 40;

export default function CreateScreen() {
	const openDocument = useStore((state) => state.openDocument);
	const router = useRouter();
	const [background, setBackground] = useState<string | null>("#FFFFFF");
	const { bottom } = useSafeAreaInsets();
	const [busy, setBusy] = useState(false);
	// Set at once, so a second tap can't start another project meanwhile.
	const creating = useRef(false);

	const handleCreate = async ({ width, height }: Size) => {
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
		<View role="main" style={styles.screen}>
			<ScreenHeader
				title="New Canvas"
				onBack={() =>
					router.canGoBack() ? router.back() : router.replace("/")
				}
			/>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
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
				<CustomSize disabled={busy} onCreate={handleCreate} />
			</ScrollView>
		</View>
	);
}

function fillName(background: string | null) {
	if (background === null) return "Transparent";
	return background === "#000000" ? "Black" : "White";
}

/** Fields for a width and height of the user's own, remembered once used. */
function CustomSize({
	disabled,
	onCreate,
}: {
	disabled: boolean;
	onCreate: (size: Size) => Promise<void>;
}) {
	const [saved, setSaved] = usePreference("customCanvasSize", parseCustomSize);
	const [width, setWidth] = useState(String(saved.width));
	const [height, setHeight] = useState(String(saved.height));
	const { size, problem } = checkCanvasSize(width, height);

	const create = () => {
		if (!size || disabled) return;
		setSaved(size);
		void onCreate(size);
	};
	const swap = () => {
		setWidth(height);
		setHeight(width);
	};

	return (
		<View style={styles.custom}>
			<Text style={styles.name}>Custom</Text>
			<View style={styles.customRow}>
				<SideField
					label="Width"
					value={width}
					onChange={setWidth}
					onSubmit={create}
				/>
				<View style={styles.swap}>
					<IconButton
						icon="swap-horizontal"
						label="Swap width and height"
						onPress={swap}
					/>
				</View>
				<SideField
					label="Height"
					value={height}
					onChange={setHeight}
					onSubmit={create}
				/>
				<View style={styles.customCreate}>
					<Button
						label="Create"
						variant="primary"
						disabled={disabled || !size}
						onPress={create}
					/>
				</View>
			</View>
			<Text style={[styles.size, problem !== null && styles.problem]}>
				{problem ??
					`${MIN_CANVAS_SIDE} to ${MAX_CANVAS_SIDE.toLocaleString("en-US")} pixels a side`}
			</Text>
			<Announcement message={problem} />
		</View>
	);
}

function SideField({
	label,
	value,
	onChange,
	onSubmit,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<View style={styles.side}>
			<Text style={styles.sideLabel}>{label}</Text>
			<TextInput
				value={value}
				// Digits only, so a pasted "1080px" still reads as a size.
				onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
				onSubmitEditing={onSubmit}
				selectTextOnFocus
				keyboardType="number-pad"
				returnKeyType="done"
				maxLength={5}
				accessibilityLabel={`${label} in pixels`}
				style={styles.sideInput}
			/>
		</View>
	);
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
		color: colors.textSecondary,
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
	custom: {
		gap: space.xs,
		padding: space.md,
		borderRadius: radii.medium,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	customRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: space.sm,
	},
	customCreate: {
		flex: 1,
		alignItems: "flex-end",
	},
	side: {
		gap: space.xxs,
	},
	// Centered on the fields beside it.
	swap: {
		height: SIDE_HEIGHT,
		justifyContent: "center",
	},
	sideLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	sideInput: {
		...typography.body,
		width: 76,
		height: SIDE_HEIGHT,
		paddingHorizontal: space.xs,
		borderRadius: radii.small,
		backgroundColor: colors.surfaceHover,
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
		textAlign: "center",
	},
	problem: {
		color: colors.danger,
	},
});
