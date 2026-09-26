import { isHexColor } from "../../../lib/color.ts";
import {
	type Brush,
	type PenTip,
	type ShapeEdit,
	type ShapeKind,
	type ShapeLayer,
	type ShapeStyle,
	shapeKinds,
} from "../../../model/document.ts";
import type { Size } from "../../../model/geometry.ts";

// A plain pen, a pen with a tip, the shapes, or the eraser.
export type DrawTool = "pen" | PenTip | "shape" | "eraser";

export type BrushSettings = {
	tool: DrawTool;
	// Every pen and shape draws in it, whatever its tip or kind.
	color: string;
	// What the shape tool drags out.
	shape: ShapeKind;
	// Indexes into each tool's `BRUSH_SIZES`; each keeps its own.
	sizes: Record<DrawTool, number>;
};

export const defaultBrushSettings: BrushSettings = {
	tool: "pen",
	color: "#FF3B30",
	shape: "arrow",
	sizes: { pen: 1, marker: 2, neon: 1, shape: 2, eraser: 3 },
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
	neon: [0.012, 0.022, 0.038, 0.06, 0.09],
	shape: [0.004, 0.008, 0.013, 0.02, 0.03],
	eraser: [0.005, 0.01, 0.02, 0.035, 0.06],
};

const DRAW_TOOLS: DrawTool[] = ["pen", "marker", "neon", "shape", "eraser"];

const shortSide = (size: Size) => Math.min(size.width, size.height);

/**
 * Brush settings from what an earlier session saved, which may be from an
 * older build, or damaged: each part that isn't valid is the default's.
 */
export function parseBrushSettings(saved: unknown): BrushSettings {
	if (typeof saved !== "object" || saved === null) return defaultBrushSettings;
	const { tool, color, shape, sizes } = saved as Record<string, unknown>;
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
	return {
		tool: DRAW_TOOLS.find((drawTool) => drawTool === tool) ?? "pen",
		color: isHexColor(color) ? color : defaultBrushSettings.color,
		shape:
			shapeKinds.find((kind) => kind === shape) ?? defaultBrushSettings.shape,
		sizes: {
			pen: sizeOf("pen"),
			marker: sizeOf("marker"),
			neon: sizeOf("neon"),
			shape: sizeOf("shape"),
			eraser: sizeOf("eraser"),
		},
	};
}

/** The index into `BRUSH_SIZES` of the tool in use. */
export function brushSizeIndex(settings: BrushSettings): number {
	return settings.sizes[settings.tool];
}

/** The tip a tool's pen has, if it's a pen with one. */
export function penTip(tool: DrawTool): PenTip | undefined {
	return tool === "marker" || tool === "neon" ? tool : undefined;
}

/** The brush the settings paint with on a canvas of `size`. */
export function brushFor(settings: BrushSettings, size: Size): Brush {
	const { tool, color } = settings;
	const width = BRUSH_SIZES[tool][settings.sizes[tool]] * shortSide(size);
	if (tool === "eraser") return { type: "eraser", width };
	const tip = penTip(tool);
	return tip
		? { type: "pen", color, width, tip }
		: { type: "pen", color, width };
}

/** How the shape tool outlines what it drags out on a canvas of `size`. */
export function shapeStyleFor(settings: BrushSettings, size: Size): ShapeStyle {
	return {
		color: settings.color,
		strokeWidth: BRUSH_SIZES.shape[settings.sizes.shape] * shortSide(size),
	};
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

/**
 * What changing the settings from `before` to `after` changes on a shape
 * scaled by `layerScale`, on a canvas of `size`: its kind, its color, or its
 * outline's thickness, in its own units.
 */
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
