import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { shapeKinds } from "@/model/layers/shape";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { RingChoice } from "@/ui/RingChoice";
import { colors, webTransition } from "@/ui/theme";
import { ColorChip, ColorOptions } from "../../shell/ColorPicker";
import { BarGroup, BarSections, OptionSegments } from "../../shell/ContextBar";
import { SHAPE_ICONS, SHAPE_NAMES } from "../../shell/shapeIcons";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
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

const PEN_TIPS = [
	{ title: "Pen", tool: "pen", icon: "draw-pen" },
	{ title: "Marker", tool: "marker", icon: "marker" },
	{ title: "Neon", tool: "neon", icon: "shimmer" },
] as const;

/**
 * Draw's options in the wide editor's header: its sub-tools, the size, the
 * pen tip while a brush is in use, and chips for the color and the shape
 * kind. Choosing the sub-tool already in use leaves it, since the options
 * stay in view.
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
	const brush = isBrush(settings.tool);
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
				<SizeChoices
					nowrap
					index={brushSizeIndex(settings)}
					color={eraser ? null : settings.color}
					tip={penTip(settings.tool)}
					onPick={pickSize}
				/>
				{brush && (
					<OptionSegments
						label="Pen tip"
						options={PEN_TIPS.map(({ title, icon }) => ({ title, icon }))}
						selected={PEN_TIPS.findIndex((tip) => tip.tool === settings.tool)}
						onSelect={(index) => {
							const tool = PEN_TIPS[index]?.tool;
							if (!tool || tool === settings.tool) return;
							onChange({ ...settings, tool, lastBrush: tool });
						}}
					/>
				)}
				{!eraser && (
					<ColorChip
						label="Color"
						value={settings.color}
						customColor={customColor}
						onPick={(color) => color && onChange({ ...settings, color })}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>
				)}
				{settings.tool === "shape" && (
					<ShapeKindChip
						shape={settings.shape}
						onPick={(shape) => onChange({ ...settings, shape })}
					/>
				)}
			</BarGroup>
		</BarSections>
	);
}

/** The shape being drawn, as an icon that opens the kinds. */
function ShapeKindChip({
	shape,
	onPick,
}: {
	shape: BrushSettings["shape"];
	onPick: (shape: BrushSettings["shape"]) => void;
}) {
	const anchor = useRef<View>(null);
	const [open, setOpen] = useState(false);
	return (
		<>
			<Pressable
				ref={anchor}
				accessibilityRole="button"
				accessibilityLabel={SHAPE_NAMES[shape]}
				accessibilityState={{ expanded: open }}
				onPress={() => setOpen((shown) => !shown)}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.kind,
						webTransition,
						hovered && styles.kindHovered,
						pressed && styles.kindPressed,
					];
				}}
			>
				<MaterialCommunityIcons
					name={SHAPE_ICONS[shape]}
					size={18}
					color={colors.textPrimary}
				/>
			</Pressable>
			<Popover
				anchor={anchor}
				open={open}
				onClose={() => setOpen(false)}
				label="Shape"
			>
				<ToolChoices nowrap>
					{shapeKinds.map((kind) => (
						<RingChoice
							key={kind}
							variant="highlight"
							label={SHAPE_NAMES[kind]}
							selected={shape === kind}
							onPress={() => onPick(kind)}
						>
							{(ink) => (
								<MaterialCommunityIcons
									name={SHAPE_ICONS[kind]}
									size={22}
									color={ink}
								/>
							)}
						</RingChoice>
					))}
				</ToolChoices>
			</Popover>
		</>
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
				<SizeChoices
					index={brushSizeIndex(settings)}
					color={eraser ? null : settings.color}
					tip={tip}
					onPick={pickSize}
				/>
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
	kind: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	kindHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	kindPressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
});
