import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { Brush } from "@/model/document";
import { colors, radii } from "@/theme";
import { GlassView } from "@/ui/GlassView";
import { RingChoice } from "@/ui/RingChoice";
import { ColorSwatches } from "../ColorSwatches";
import { ToolButton } from "../ToolButton";
import { type BrushSettings, brushSizeIndex } from "./brushSettings";

// Each size's dot in the picker, in points: its order, not its true width.
const SIZE_DOTS = [4, 7, 11, 16, 22];

/**
 * The drawing tools, in place of the toolbar while drawing: the pen, the
 * eraser, and the brush's options, which open over the canvas. Tapping the
 * tool that's in use opens them too.
 */
export function DrawPanel({
	settings,
	optionsOpen,
	onChange,
	onToggleOptions,
}: {
	settings: BrushSettings;
	optionsOpen: boolean;
	onChange: (settings: BrushSettings) => void;
	onToggleOptions: () => void;
}) {
	const pickTool = (tool: Brush["type"]) => {
		if (tool === settings.tool) onToggleOptions();
		else onChange({ ...settings, tool });
	};
	const pen = settings.tool === "pen";
	return (
		<View style={styles.row}>
			<ToolButton
				label="Pen"
				icon="draw-pen"
				selected={pen}
				onPress={() => pickTool("pen")}
			/>
			<ToolButton
				label="Eraser"
				icon="eraser"
				selected={!pen}
				onPress={() => pickTool("eraser")}
			/>
			<ToolButton
				label={pen ? "Style" : "Size"}
				icon="palette-outline"
				glyph={
					<SizeDot
						size={SIZE_DOTS[brushSizeIndex(settings)]}
						color={pen ? settings.color : null}
					/>
				}
				selected={optionsOpen}
				onPress={onToggleOptions}
			/>
		</View>
	);
}

/**
 * The brush's color and size, in a card over the canvas, `bottomInset` up
 * from its bottom, just above the panel. A tap anywhere else on the canvas
 * closes it, rather than drawing.
 */
export function BrushOptions({
	settings,
	bottomInset,
	onChange,
	onClose,
}: {
	settings: BrushSettings;
	bottomInset: number;
	onChange: (settings: BrushSettings) => void;
	onClose: () => void;
}) {
	const pen = settings.tool === "pen";
	const pickSize = (size: number) =>
		onChange(
			pen ? { ...settings, penSize: size } : { ...settings, eraserSize: size },
		);
	return (
		<Animated.View
			entering={FadeIn.duration(120)}
			exiting={FadeOut.duration(100)}
			style={StyleSheet.absoluteFill}
		>
			{/* Behind the card, not around it: on web, a click on the card would
				bubble up to it and close the card. */}
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onClose}
				accessibilityLabel="Close brush options"
			/>
			<View style={[styles.cardArea, { bottom: bottomInset + 10 }]}>
				<GlassView style={styles.card} contentStyle={styles.cardContent}>
					{pen && (
						<View style={styles.option}>
							<Text style={styles.optionLabel}>Color</Text>
							<ColorSwatches
								value={settings.color}
								onPick={(color) => color && onChange({ ...settings, color })}
							/>
						</View>
					)}
					<View style={styles.option}>
						<Text style={styles.optionLabel}>Size</Text>
						<View style={styles.sizes}>
							{SIZE_DOTS.map((dot, index) => (
								<RingChoice
									key={dot}
									label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
									selected={index === brushSizeIndex(settings)}
									onPress={() => pickSize(index)}
								>
									<SizeDot size={dot} color={pen ? settings.color : null} />
								</RingChoice>
							))}
						</View>
					</View>
				</GlassView>
			</View>
		</Animated.View>
	);
}

/** A brush's tip: filled with its color, or an outline for the eraser. */
function SizeDot({ size, color }: { size: number; color: string | null }) {
	return (
		<View
			style={[
				styles.dot,
				{ width: size, height: size, borderRadius: size / 2 },
				color === null
					? styles.eraserDot
					: { backgroundColor: color, borderColor: colors.borderStrong },
			]}
		/>
	);
}

const styles = StyleSheet.create({
	// Like the toolbar it replaces.
	row: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 28,
		paddingHorizontal: 20,
	},
	cardArea: {
		position: "absolute",
		left: 10,
		right: 10,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	card: {
		borderRadius: radii.extraLarge,
	},
	cardContent: {
		gap: 4,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	optionLabel: {
		width: 40,
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	sizes: {
		flexDirection: "row",
		// As the swatches do, so the rows' first choices line up.
		marginHorizontal: -9,
	},
	dot: {
		borderWidth: StyleSheet.hairlineWidth,
	},
	eraserDot: {
		borderWidth: 1.5,
		borderColor: colors.textPrimary,
	},
});
