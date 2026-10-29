import type { CanvasTool } from "../../canvas/canvasTool.ts";
import type { Size } from "../../document/geometry.ts";
import type { MaskStroke } from "../../layers/strokes.ts";
import {
	isIndex,
	type RedactLook,
	redactionEffect,
	shortSide,
} from "../../shell/redactLook.ts";

export type RedactTool = "box" | "brush" | "eraser";

// What Redact paints with: `brushSize` and `eraserSize` index into
// `REDACT_BRUSH_SIZES`, so the brush and eraser each keep their own. The look
// is the editor's (`useRedactLook`).
export type RedactSettings = {
	tool: RedactTool;
	brushSize: number;
	eraserSize: number;
};

// Redact's settings with the look, as its controls show them.
export type RedactChoices = RedactLook & RedactSettings;

export const defaultRedactSettings: RedactSettings = {
	tool: "box",
	brushSize: 2,
	eraserSize: 2,
};

// Brush widths as a share of the canvas's shorter side, like the draw tool's
// sizes. They start at about a line of a screenshot's text.
export const REDACT_BRUSH_SIZES = [0.02, 0.035, 0.05, 0.075, 0.11];

const REDACT_TOOLS: RedactTool[] = ["box", "brush", "eraser"];

/**
 * Redact settings from what an earlier session saved, which may be from an
 * older build, or damaged: each part that isn't valid is the default's.
 */
export function parseRedactSettings(saved: unknown): RedactSettings {
	const fields =
		typeof saved === "object" && saved !== null
			? (saved as Record<string, unknown>)
			: {};
	const sizeOf = (key: "brushSize" | "eraserSize") => {
		const size = fields[key];
		return isIndex(size, REDACT_BRUSH_SIZES.length)
			? size
			: defaultRedactSettings[key];
	};
	return {
		tool: REDACT_TOOLS.find((tool) => tool === fields.tool) ?? "box",
		brushSize: sizeOf("brushSize"),
		eraserSize: sizeOf("eraserSize"),
	};
}

// Where the brush and the eraser each keep their size.
const SIZE_KEYS = { brush: "brushSize", eraser: "eraserSize" } as const;

/**
 * The size of the tool in use, an index into `REDACT_BRUSH_SIZES`. Null for
 * the box, which has none.
 */
export function redactSizeIndex(settings: RedactSettings): number | null {
	return settings.tool === "box" ? null : settings[SIZE_KEYS[settings.tool]];
}

/**
 * Settings with the brush or eraser in use at size `index`; the other keeps
 * its own. The box has no size, so its settings stay as they are.
 */
export function withRedactSize<T extends RedactSettings>(
	settings: T,
	index: number,
): T {
	return settings.tool === "box"
		? settings
		: { ...settings, [SIZE_KEYS[settings.tool]]: index };
}

/** The brush or eraser, one size dot up or down. A box has no size. */
export function stepRedactSize<T extends RedactSettings>(
	settings: T,
	step: 1 | -1,
): T {
	const index = redactSizeIndex(settings);
	if (index === null) return settings;
	const next = Math.min(
		REDACT_BRUSH_SIZES.length - 1,
		Math.max(0, index + step),
	);
	if (next === index) return settings;
	return withRedactSize(settings, next);
}

/**
 * What the brush or eraser paints with on a canvas of `size`, or null when
 * the tool drags boxes.
 */
export function maskBrush(
	settings: RedactSettings,
	size: Size,
): Omit<MaskStroke, "points"> | null {
	const index = redactSizeIndex(settings);
	if (index === null) return null;
	return {
		type: settings.tool === "brush" ? "pen" : "eraser",
		width: REDACT_BRUSH_SIZES[index] * shortSide(size),
	};
}

/**
 * What dragging on a canvas of `size` does with Redact: paints with its
 * brush or eraser, or drags out its box.
 */
export function redactCanvasTool(
	settings: RedactChoices,
	size: Size,
): CanvasTool {
	const effect = redactionEffect(settings, size);
	const brush = maskBrush(settings, size);
	return brush
		? { type: "redactBrush", brush, effect }
		: { type: "redactBox", effect };
}
