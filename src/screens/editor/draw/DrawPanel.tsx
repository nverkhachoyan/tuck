import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { shapeKinds } from "@/model/document";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { ColorOptions } from "../controls/ColorPicker";
import { SHAPE_ICONS, SHAPE_NAMES } from "../controls/shapeIcons";
import { ToolButton, ToolRow } from "../controls/ToolButton";
import {
	SIZE_DOTS,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../controls/ToolOptions";
import {
	type BrushSettings,
	type BrushTool,
	brushSizeIndex,
	type DrawTool,
	penTip,
} from "./brushSettings";

const TOOL_ICONS = {
	pen: "draw-pen",
	marker: "marker",
	neon: "shimmer",
	eraser: "eraser",
} as const;

const BRUSH_NAMES: Record<BrushTool, string> = {
	pen: "Pen",
	marker: "Marker",
	neon: "Neon",
};

/**
 * The drawing tools, in place of the toolbar while drawing: Brush returns to
 * the last pen, Shape drags its shown kind, Eraser removes marks, and Style
 * opens the shared options tray. Tapping the active tool opens that tray too.
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
	const pickTool = (tool: DrawTool) => {
		if (tool === settings.tool) onToggleOptions();
		else onChange({ ...settings, tool });
	};
	const pickBrush = () => {
		if (isBrush(settings.tool)) onToggleOptions();
		else onChange({ ...settings, tool: settings.lastBrush });
	};
	return (
		<ToolRow>
			<ToolButton
				label="Brush"
				icon={TOOL_ICONS[settings.lastBrush]}
				selected={isBrush(settings.tool)}
				onPress={pickBrush}
			/>
			<ToolButton
				label="Shape"
				icon={SHAPE_ICONS[settings.shape]}
				selected={settings.tool === "shape"}
				onPress={() => pickTool("shape")}
			/>
			<ToolButton
				label="Eraser"
				icon="eraser"
				selected={settings.tool === "eraser"}
				onPress={() => pickTool("eraser")}
			/>
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<ColorGlyph color={settings.color} />}
				open={optionsOpen}
				onPress={onToggleOptions}
			/>
		</ToolRow>
	);
}

/**
 * The brush's color and size, and the shape tool's kind, in a tray above the
 * dock (see `ToolOptions`). The custom swatch opens a picker for any color
 * (see `ColorOptions`).
 */
export function BrushOptions({
	settings,
	customColor,
	bottomInset,
	onChange,
	onPickCustom,
	onEyedropper,
	onClose,
}: {
	settings: BrushSettings;
	customColor: string | null;
	bottomInset: number;
	onChange: (settings: BrushSettings) => void;
	// A color from the picker, which becomes the editor's custom color.
	onPickCustom: (color: string) => void;
	// Sets out to pick the brush's color from the canvas.
	onEyedropper: () => void;
	onClose: () => void;
}) {
	const eraser = settings.tool === "eraser";
	const tip = penTip(settings.tool);
	const pickBrush = (brush: BrushTool) =>
		onChange({ ...settings, tool: brush, lastBrush: brush });
	const pickSize = (size: number) =>
		onChange({
			...settings,
			sizes: { ...settings.sizes, [settings.tool]: size },
		});

	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			onClose={onClose}
			dismissOnOutsidePress={false}
		>
			{isBrush(settings.tool) && (
				<ToolOption label="Brush">
					<ToolChoices>
						{(["pen", "marker", "neon"] as const).map((brush) => (
							<RingChoice
								key={brush}
								variant="highlight"
								label={BRUSH_NAMES[brush]}
								selected={settings.tool === brush}
								onPress={() => pickBrush(brush)}
							>
								{(ink) => (
									<MaterialCommunityIcons
										name={TOOL_ICONS[brush]}
										size={22}
										color={ink}
									/>
								)}
							</RingChoice>
						))}
					</ToolChoices>
				</ToolOption>
			)}
			{settings.tool === "shape" && (
				<ToolOption label="Shape">
					<ToolChoices>
						{shapeKinds.map((shape) => (
							<RingChoice
								key={shape}
								variant="highlight"
								label={SHAPE_NAMES[shape]}
								selected={settings.shape === shape}
								onPress={() => onChange({ ...settings, shape })}
							>
								{(ink) => (
									<MaterialCommunityIcons
										name={SHAPE_ICONS[shape]}
										size={22}
										color={ink}
									/>
								)}
							</RingChoice>
						))}
					</ToolChoices>
				</ToolOption>
			)}
			{!eraser && (
				<ToolOption label="Color">
					<ColorOptions
						value={settings.color}
						customColor={customColor}
						onPick={(color) => color && onChange({ ...settings, color })}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>
				</ToolOption>
			)}
			<ToolOption label="Size">
				<ToolChoices>
					{SIZE_DOTS.map((dot, index) => (
						<RingChoice
							key={dot}
							label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
							selected={index === brushSizeIndex(settings)}
							onPress={() => pickSize(index)}
						>
							<SizeDot
								size={dot}
								color={eraser ? null : settings.color}
								tip={tip}
							/>
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
		</ToolOptions>
	);
}

function isBrush(tool: DrawTool): tool is BrushTool {
	return tool === "pen" || tool === "marker" || tool === "neon";
}

/** The current brush color in the dock's Style tile. */
function ColorGlyph({ color }: { color: string }) {
	return <View style={[styles.colorTile, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
	colorTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
});
