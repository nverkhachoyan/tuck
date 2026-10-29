import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { shapeKinds } from "../../layers/shape/shape";
import { ColorChip, ColorOptions } from "../../shell/ColorOptions";
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
	isBrush,
	penTip,
	withBrushColor,
	withBrushSize,
} from "./brushSettings";
import type { DrawController } from "./useDrawTool";

// Draw's brushes, in the order the tip chip and the tray list them: each
// one's tool, its name, and its icon, which the dock's Brush shows for the
// last brush.
const BRUSHES = [
	{ tool: "pen", title: "Pen", icon: "draw-pen" },
	{ tool: "marker", title: "Highlighter", icon: "marker" },
	{ tool: "ink", title: "Marker", icon: "brush" },
	{ tool: "neon", title: "Neon", icon: "shimmer" },
] as const satisfies readonly {
	tool: BrushTool;
	title: string;
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}[];

const brushOf = (tool: BrushTool) =>
	BRUSHES.find((brush) => brush.tool === tool) ?? BRUSHES[0];

/**
 * The drawing tools, in place of the toolbar while drawing: Brush returns to
 * the last pen, Shape drags its shown kind, Eraser removes marks, and Style
 * opens the shared options tray. Tapping the active tool opens that tray too.
 */
export function DrawPanel({
	controller: { settings, change },
}: {
	controller: DrawController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();
	const pickTool = (tool: DrawTool) => {
		if (tool === settings.tool) toggleTray();
		else change({ ...settings, tool });
	};
	const pickBrush = () => {
		if (isBrush(settings.tool)) toggleTray();
		else change({ ...settings, tool: settings.lastBrush });
	};
	return (
		<ToolRow>
			<ToolButton
				label="Brush"
				icon={brushOf(settings.lastBrush).icon}
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
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

// The sub-tools the bar's segments choose between. Brush brings back the
// last brush.
const DRAW_SUB_TOOLS = [
	{ tool: "brush", title: "Brush" },
	{ tool: "shape", title: "Shape" },
	{ tool: "eraser", title: "Eraser" },
] as const;

/**
 * Draw's options in the wide editor's header: its sub-tools, then the pen
 * tip or the shape kind, the color, and the size. The tip, kind, and size
 * are chips; the color stays a swatch. Choosing the sub-tool already in use
 * leaves it, since the options stay in view.
 */
export function DrawBar({
	controller: { settings, change },
}: {
	controller: DrawController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withBrushColor(settings, color)),
	);
	const eraser = settings.tool === "eraser";
	const icons = {
		brush: brushOf(settings.lastBrush).icon,
		shape: SHAPE_ICONS[settings.shape],
		eraser: "eraser",
	} as const;
	const selected = DRAW_SUB_TOOLS.findIndex(
		({ tool }) => tool === (isBrush(settings.tool) ? "brush" : settings.tool),
	);
	const pickTool = (index: number) => {
		const next = DRAW_SUB_TOOLS[index]?.tool;
		if (!next || index === selected) return;
		change({
			...settings,
			tool: next === "brush" ? settings.lastBrush : next,
		});
	};
	const pickSize = (size: number) => change(withBrushSize(settings, size));
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Draw tool"
					options={DRAW_SUB_TOOLS.map(({ tool, title }) => ({
						title,
						icon: icons[tool],
					}))}
					selected={selected}
					onSelect={pickTool}
				/>
			</BarGroup>
			<BarGroup>
				{isBrush(settings.tool) && (
					<PenTipChip
						tool={settings.tool}
						onPick={(tool) => change({ ...settings, tool, lastBrush: tool })}
					/>
				)}
				{settings.tool === "shape" && (
					<ShapeKindChip
						shape={settings.shape}
						onPick={(shape) => change({ ...settings, shape })}
					/>
				)}
				{!eraser && (
					<ColorChip
						label="Color"
						value={brushColor(settings)}
						customColor={customColor}
						onPick={(color) => color && change(withBrushColor(settings, color))}
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

/** The brush in use, by name, opening every brush in `BRUSHES`. */
function PenTipChip({
	tool,
	onPick,
}: {
	tool: BrushTool;
	onPick: (tool: BrushTool) => void;
}) {
	const tip = brushOf(tool);
	return (
		<BarChip label={tip.title} icon={tip.icon} text={tip.title}>
			{(close) => (
				<OptionSegments
					label="Pen tip"
					options={BRUSHES.map(({ title, icon }) => ({ title, icon }))}
					selected={BRUSHES.indexOf(tip)}
					onSelect={(index) => {
						const next = BRUSHES[index]?.tool;
						if (next && next !== tool) onPick(next);
						close();
					}}
				/>
			)}
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
			{(close) => (
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
						close();
					}}
				/>
			)}
		</BarChip>
	);
}

/**
 * The brush's color and size, and the shape tool's kind, in a tray above the
 * dock (see `ToolOptions`). The custom swatch opens a picker for any color
 * (see `ColorOptions`), and the eyedropper picks one from the canvas.
 */
export function BrushOptions({
	controller: { settings, change },
}: {
	controller: DrawController;
}) {
	const { bottomInset, closeTray } = useEditorContext();
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withBrushColor(settings, color)),
	);
	const eraser = settings.tool === "eraser";
	const tip = penTip(settings.tool);
	const pickBrush = (brush: BrushTool) =>
		change({ ...settings, tool: brush, lastBrush: brush });
	const pickSize = (size: number) => change(withBrushSize(settings, size));

	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			{isBrush(settings.tool) && (
				<ToolOption label="Brush">
					<ToolChoices>
						{BRUSHES.map(({ tool, title, icon }) => (
							<RingChoice
								key={tool}
								variant="highlight"
								label={title}
								selected={settings.tool === tool}
								onPress={() => pickBrush(tool)}
							>
								{(ink) => (
									<MaterialCommunityIcons name={icon} size={22} color={ink} />
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
								onPress={() => change({ ...settings, shape })}
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
						onPick={(color) => color && change(withBrushColor(settings, color))}
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
