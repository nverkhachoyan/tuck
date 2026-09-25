import type { Brush, PenTip } from "../../../model/document.ts";
import type { Size } from "../../../model/geometry.ts";

// A plain pen, a pen with a tip, or the eraser.
export type DrawTool = "pen" | PenTip | "eraser";

export type BrushSettings = {
	tool: DrawTool;
	// Every pen draws in it, whatever its tip.
	color: string;
	// The last color picked from the spectrum rather than a swatch, which
	// its swatch keeps while another is in use. Null until there's one.
	customColor: string | null;
	// Indexes into each tool's `BRUSH_SIZES`; each keeps its own.
	sizes: Record<DrawTool, number>;
};

export const defaultBrushSettings: BrushSettings = {
	tool: "pen",
	color: "#FF3B30",
	customColor: null,
	sizes: { pen: 1, marker: 2, neon: 1, eraser: 3 },
};

// Brush widths as a share of the canvas's shorter side, like a new text's
// size, so a size looks the same on a screenshot as on a camera photo. A
// marker's run wider, to cover a line of text, and a neon's take in its glow,
// which is wider than its line. Each tool has five, one for each size dot.
export const BRUSH_SIZES: Record<DrawTool, number[]> = {
	pen: [0.005, 0.01, 0.02, 0.035, 0.06],
	marker: [0.015, 0.025, 0.04, 0.06, 0.09],
	neon: [0.012, 0.022, 0.038, 0.06, 0.09],
	eraser: [0.005, 0.01, 0.02, 0.035, 0.06],
};

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
	const width =
		BRUSH_SIZES[tool][settings.sizes[tool]] * Math.min(size.width, size.height);
	if (tool === "eraser") return { type: "eraser", width };
	const tip = penTip(tool);
	return tip
		? { type: "pen", color, width, tip }
		: { type: "pen", color, width };
}
