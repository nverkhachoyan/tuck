import type { Size } from "../../../model/geometry.ts";
import type { Brush, PenTip } from "../../../model/layers/drawing.ts";
import {
	type ShapeEdit,
	type ShapeKind,
	type ShapeLayer,
	type ShapeStyle,
	shapeKinds,
} from "../../../model/layers/shape.ts";
import { isHexColor } from "../../../ui/color.ts";
import type { CanvasTool } from "../../canvas/canvasTool.ts";

export type DrawTool = "pen" | PenTip | "shape" | "eraser";
export type BrushTool = "pen" | PenTip;

export type BrushSettings = {
	tool: DrawTool;
	// The brush Brush returns to after drawing a shape or erasing.
	lastBrush: BrushTool;
	// Every pen and shape draws in it, except the highlighter, which keeps
	// `highlightColor`. The see-through marker uses this shared color too.
	color: string;
	// The highlighter's own color. Yellow to start.
	highlightColor: string;
	// What the shape tool drags out.
	shape: ShapeKind;
	// Indexes into each tool's `BRUSH_SIZES`; each keeps its own.
	sizes: Record<DrawTool, number>;
};

export const defaultBrushSettings: BrushSettings = {
	tool: "pen",
	lastBrush: "pen",
	color: "#FF3B30",
	highlightColor: "#FFD60A",
	shape: "arrow",
	sizes: { pen: 1, marker: 2, ink: 2, neon: 1, shape: 2, eraser: 3 },
};

// Brush widths as a share of the canvas's shorter side, like a new text's
// size, so a size looks the same on a screenshot as on a camera photo. A
// marker's run wider, to cover a line of text, and a neon's take in its glow,
// which is wider than its line. A shape's outline runs thinner than a pen,
// as its arrow's head spreads well past its line. Each tool has five, one for
// each size dot.
export const BRUSH_SIZES: Record<DrawTool, number[]> = {
	pen: [0.005, 0.01, 0.02, 0.035, 0.06],
	marker: [0.015, 0.025, 0.04, 0.06, 0.09],
	ink: [0.015, 0.025, 0.04, 0.06, 0.09],
	neon: [0.012, 0.022, 0.038, 0.06, 0.09],
	shape: [0.004, 0.008, 0.013, 0.02, 0.03],
	eraser: [0.005, 0.01, 0.02, 0.035, 0.06],
};

const DRAW_TOOLS: DrawTool[] = [
	"pen",
	"marker",
	"ink",
	"neon",
	"shape",
	"eraser",
];
const BRUSH_TOOLS: BrushTool[] = ["pen", "marker", "ink", "neon"];

/** Whether `tool` is a brush: the pen, or the pen with one of its tips. */
export function isBrush(tool: DrawTool): tool is BrushTool {
	return BRUSH_TOOLS.some((brush) => brush === tool);
}

const shortSide = (size: Size) => Math.min(size.width, size.height);

/**
 * Brush settings from what an earlier session saved, which may be from an
 * older build, or damaged: each part that isn't valid is the default's.
 */
export function parseBrushSettings(saved: unknown): BrushSettings {
	if (typeof saved !== "object" || saved === null) return defaultBrushSettings;
	const { tool, lastBrush, color, highlightColor, shape, sizes } =
		saved as Record<string, unknown>;
	const savedSizes = (
		typeof sizes === "object" && sizes !== null ? sizes : {}
	) as Record<string, unknown>;
	const sizeOf = (drawTool: DrawTool) => {
		const size = savedSizes[drawTool];
		return typeof size === "number" &&
			Number.isInteger(size) &&
			size >= 0 &&
			size < BRUSH_SIZES[drawTool].length
			? size
			: defaultBrushSettings.sizes[drawTool];
	};
	const parsedTool = DRAW_TOOLS.find((drawTool) => drawTool === tool) ?? "pen";
	return {
		tool: parsedTool,
		// Older builds saved each brush directly in `tool`. Preserve that
		// preference when migrating them; otherwise start new records at pen.
		lastBrush:
			BRUSH_TOOLS.find((brush) => brush === lastBrush) ??
			BRUSH_TOOLS.find((brush) => brush === parsedTool) ??
			"pen",
		color: isHexColor(color) ? color : defaultBrushSettings.color,
		highlightColor: isHexColor(highlightColor)
			? highlightColor
			: defaultBrushSettings.highlightColor,
		shape:
			shapeKinds.find((kind) => kind === shape) ?? defaultBrushSettings.shape,
		sizes: {
			pen: sizeOf("pen"),
			marker: sizeOf("marker"),
			ink: sizeOf("ink"),
			neon: sizeOf("neon"),
			shape: sizeOf("shape"),
			eraser: sizeOf("eraser"),
		},
	};
}

export function brushSizeIndex(settings: BrushSettings): number {
	return settings.sizes[settings.tool];
}

/** Settings with the tool in use at size `index`; the others keep theirs. */
export function withBrushSize(
	settings: BrushSettings,
	index: number,
): BrushSettings {
	return { ...settings, sizes: { ...settings.sizes, [settings.tool]: index } };
}

export function penTip(tool: DrawTool): PenTip | undefined {
	return isBrush(tool) && tool !== "pen" ? tool : undefined;
}

/** The color the tool in use draws with. The highlighter keeps its own. */
export function brushColor(settings: BrushSettings): string {
	return settings.tool === "marker" ? settings.highlightColor : settings.color;
}

/** Settings with the tool in use drawing in `color`. */
export function withBrushColor(
	settings: BrushSettings,
	color: string,
): BrushSettings {
	return settings.tool === "marker"
		? { ...settings, highlightColor: color }
		: { ...settings, color };
}

export function brushFor(settings: BrushSettings, size: Size): Brush {
	const { tool } = settings;
	const color = brushColor(settings);
	const width = BRUSH_SIZES[tool][settings.sizes[tool]] * shortSide(size);
	if (tool === "eraser") return { type: "eraser", width };
	const tip = penTip(tool);
	return tip
		? { type: "pen", color, width, tip }
		: { type: "pen", color, width };
}

export function shapeStyleFor(settings: BrushSettings, size: Size): ShapeStyle {
	return {
		color: settings.color,
		strokeWidth: BRUSH_SIZES.shape[settings.sizes.shape] * shortSide(size),
	};
}

/**
 * What dragging on a canvas of `size` does with Draw: drags out its shape,
 * or draws with its brush.
 */
export function drawCanvasTool(
	settings: BrushSettings,
	size: Size,
): CanvasTool {
	return settings.tool === "shape"
		? {
				type: "drawShape",
				shape: settings.shape,
				style: shapeStyleFor(settings, size),
			}
		: { type: "draw", brush: brushFor(settings, size) };
}

/** The tool in use, one size dot up or down, staying put at either end. */
export function stepBrushSize(
	settings: BrushSettings,
	step: 1 | -1,
): BrushSettings {
	const count = BRUSH_SIZES[settings.tool].length;
	const next = Math.min(
		count - 1,
		Math.max(0, brushSizeIndex(settings) + step),
	);
	if (next === brushSizeIndex(settings)) return settings;
	return withBrushSize(settings, next);
}

/**
 * The settings showing an existing shape: its kind, its color, and the size
 * closest to its outline's thickness as it's scaled, on a canvas of `size`.
 */
export function withShape(
	settings: BrushSettings,
	layer: ShapeLayer,
	size: Size,
): BrushSettings {
	const share = (layer.strokeWidth * layer.transform.scaleX) / shortSide(size);
	const widths = BRUSH_SIZES.shape;
	let index = 0;
	widths.forEach((width, candidate) => {
		if (Math.abs(width - share) < Math.abs(widths[index] - share)) {
			index = candidate;
		}
	});
	return {
		...settings,
		shape: layer.shape,
		color: layer.color,
		sizes: { ...settings.sizes, shape: index },
	};
}

/** The outline's thickness comes out in the shape's own units. */
export function shapeEdit(
	before: BrushSettings,
	after: BrushSettings,
	size: Size,
	layerScale: number,
): ShapeEdit {
	const edit: ShapeEdit = {};
	if (after.shape !== before.shape) edit.shape = after.shape;
	if (after.color !== before.color) edit.color = after.color;
	if (after.sizes.shape !== before.sizes.shape) {
		edit.strokeWidth = shapeStyleFor(after, size).strokeWidth / layerScale;
	}
	return edit;
}
