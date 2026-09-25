import type { Brush } from "../../../model/document.ts";
import type { Size } from "../../../model/geometry.ts";

export type BrushSettings = {
	tool: Brush["type"];
	color: string;
	// Indexes into `BRUSH_SIZES`; the pen and eraser each keep their own.
	penSize: number;
	eraserSize: number;
};

export const defaultBrushSettings: BrushSettings = {
	tool: "pen",
	color: "#FF3B30",
	penSize: 1,
	eraserSize: 3,
};

// Brush widths as a share of the canvas's shorter side, like a new text's
// size, so a size looks the same on a screenshot as on a camera photo.
export const BRUSH_SIZES = [0.005, 0.01, 0.02, 0.035, 0.06];

/** The index into `BRUSH_SIZES` of the tool in use. */
export function brushSizeIndex(settings: BrushSettings): number {
	return settings.tool === "pen" ? settings.penSize : settings.eraserSize;
}

/** The brush the settings paint with on a canvas of `size`. */
export function brushFor(settings: BrushSettings, size: Size): Brush {
	const side = Math.min(size.width, size.height);
	return settings.tool === "pen"
		? {
				type: "pen",
				color: settings.color,
				width: BRUSH_SIZES[settings.penSize] * side,
			}
		: { type: "eraser", width: BRUSH_SIZES[settings.eraserSize] * side };
}
