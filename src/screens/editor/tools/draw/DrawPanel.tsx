import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { shapeKinds } from "@/model/layers/shape";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { ColorChip, ColorOptions } from "../../shell/ColorPicker";
import {
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { SHAPE_ICONS, SHAPE_NAMES } from "../../shell/shapeIcons";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChip,
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import {
	type BrushSettings,
	type BrushTool,
	brushColor,
	brushSizeIndex,
	type DrawTool,
	penTip,
	withBrushColor,
} from "./brushSettings";

const TOOL_ICONS = {
	pen: "draw-pen",
	marker: "marker",
	ink: "brush",
	neon: "shimmer",
	eraser: "eraser",
} as const;

const BRUSH_NAMES: Record<BrushTool, string> = {
	pen: "Pen",
	marker: "Highlighter",
	ink: "Marker",
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
				glyph={<ColorGlyph color={brushColor(settings)} />}
				open={optionsOpen}
				onPress={onToggleOptions}
			/>
		</ToolRow>
	);
}

const PEN_TIPS = [
	{ title: "Pen", tool: "pen", icon: "draw-pen" },
	{ title: "Highlighter", tool: "marker", icon: "marker" },
	{ title: "Marker", tool: "ink", icon: "brush" },
	{ title: "Neon", tool: "neon", icon: "shimmer" },
] as const;

/**
 * Draw's options in the wide editor's header: its sub-tools, then the pen
 * tip or the shape kind, the color, and the size. The tip, kind, and size
 * are chips; the color stays a swatch. Choosing the sub-tool already in use
 * leaves it, since the options stay in view.
 */
export function DrawBar({
	settings,
	customColor,
	onChange,
	onPickCustom,
	onEyedropper,
}: {
	settings: BrushSettings;
	customColor: string | null;
	onChange: (settings: BrushSettings) => void;
	onPickCustom: (color: string) => void;
	onEyedropper: () => void;
}) {
	const eraser = settings.tool === "eraser";
	const selected =
		settings.tool === "shape" ? 1 : settings.tool === "eraser" ? 2 : 0;
	const pickTool = (index: number) => {
		if (index === selected) return;
		if (index === 0) onChange({ ...settings, tool: settings.lastBrush });
		else if (index === 1) onChange({ ...settings, tool: "shape" });
		else onChange({ ...settings, tool: "eraser" });
	};
	const pickSize = (size: number) =>
		onChange({
			...settings,
			sizes: { ...settings.sizes, [settings.tool]: size },
		});
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Draw tool"
					options={[
						{ title: "Brush", icon: TOOL_ICONS[settings.lastBrush] },
						{ title: "Shape", icon: SHAPE_ICONS[settings.shape] },
						{ title: "Eraser", icon: "eraser" },
					]}
					selected={selected}
					onSelect={pickTool}
				/>
			</BarGroup>
			<BarGroup>
				{isBrush(settings.tool) && (
					<PenTipChip
						tool={settings.tool}
						onPick={(tool) => onChange({ ...settings, tool, lastBrush: tool })}
					/>
				)}
				{settings.tool === "shape" && (
					<ShapeKindChip
						shape={settings.shape}
						onPick={(shape) => onChange({ ...settings, shape })}
					/>
				)}
				{!eraser && (
					<ColorChip
						label="Color"
						value={brushColor(settings)}
						customColor={customColor}
						onPick={(color) =>
							color && onChange(withBrushColor(settings, color))
						}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>
				)}
				<SizeChip
					index={brushSizeIndex(settings)}
					color={eraser ? null : brushColor(settings)}
					tip={penTip(settings.tool)}
					onPick={pickSize}
				/>
			</BarGroup>
		</BarSections>
	);
}

/** The pen in use, opening Pen, Highlighter, and Neon. */
function PenTipChip({
	tool,
	onPick,
}: {
	tool: BrushTool;
	onPick: (tool: BrushTool) => void;
}) {
	const selected = PEN_TIPS.findIndex((tip) => tip.tool === tool);
	const tip = PEN_TIPS[selected] ?? PEN_TIPS[0];
	return (
		<BarChip label={tip.title} icon={tip.icon} text={tip.title}>
			<OptionSegments
				label="Pen tip"
				options={PEN_TIPS.map(({ title, icon }) => ({ title, icon }))}
				selected={selected}
				onSelect={(index) => {
					const next = PEN_TIPS[index]?.tool;
					if (next && next !== tool) onPick(next);
				}}
			/>
		</BarChip>
	);
}

/** The shape being drawn, by name, opening the kinds. */
function ShapeKindChip({
	shape,
	onPick,
}: {
	shape: BrushSettings["shape"];
	onPick: (shape: BrushSettings["shape"]) => void;
}) {
	return (
		<BarChip
			label={SHAPE_NAMES[shape]}
			icon={SHAPE_ICONS[shape]}
			text={SHAPE_NAMES[shape]}
		>
			<OptionSegments
				label="Shape"
				options={shapeKinds.map((kind) => ({
					title: SHAPE_NAMES[kind],
					icon: SHAPE_ICONS[kind],
				}))}
				selected={shapeKinds.indexOf(shape)}
				onSelect={(index) => {
					const kind = shapeKinds[index];
					if (kind && kind !== shape) onPick(kind);
				}}
			/>
		</BarChip>
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
						{(["pen", "marker", "ink", "neon"] as const).map((brush) => (
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
						value={brushColor(settings)}
						customColor={customColor}
						onPick={(color) =>
							color && onChange(withBrushColor(settings, color))
						}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>
				</ToolOption>
			)}
			<ToolOption label="Size">
				<SizeChoices
					index={brushSizeIndex(settings)}
					color={eraser ? null : brushColor(settings)}
					tip={tip}
					onPick={pickSize}
				/>
			</ToolOption>
		</ToolOptions>
	);
}

function isBrush(tool: DrawTool): tool is BrushTool {
	return (
		tool === "pen" || tool === "marker" || tool === "ink" || tool === "neon"
	);
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
