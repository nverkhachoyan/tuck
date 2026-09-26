import { isHexColor } from "../../../lib/color.ts";
import type { MaskStroke, RedactionEffect } from "../../../model/document.ts";
import type { Size } from "../../../model/geometry.ts";

// Drags a box, paints strokes, or erases them.
export type RedactTool = "box" | "brush" | "eraser";

export type RedactSettings = {
	tool: RedactTool;
	effect: RedactionEffect["type"];
	color: string;
	// Indexes into `BLUR_STRENGTHS` or `PIXEL_SIZES`, whichever the effect
	// uses, and `REDACT_BRUSH_SIZES`; the brush and eraser each keep their
	// own size.
	strength: number;
	brushSize: number;
	eraserSize: number;
};

// Solid black: the one nothing can be read back from.
export const defaultRedactSettings: RedactSettings = {
	tool: "box",
	effect: "solid",
	color: "#000000",
	strength: 1,
	brushSize: 2,
	eraserSize: 2,
};

// Blur sigmas, pixel sides, and brush widths as a share of the canvas's
// shorter side, like the draw tool's sizes, so they look the same on a
// screenshot as on a camera photo. The lightest blur, and the smallest
// pixels, still leave text in a screenshot unreadable: a line of it is about
// two pixels tall. Brushes start at about a line of its text.
export const BLUR_STRENGTHS = [0.008, 0.016, 0.03];
export const PIXEL_SIZES = [0.02, 0.035, 0.055];
export const REDACT_BRUSH_SIZES = [0.02, 0.035, 0.05, 0.075, 0.11];

const shortSide = (size: Size) => Math.min(size.width, size.height);

const REDACT_TOOLS: RedactTool[] = ["box", "brush", "eraser"];
const EFFECTS: RedactSettings["effect"][] = ["solid", "blur", "pixelate"];

/**
 * Redact settings from what an earlier session saved, which may be from an
 * older build, or damaged: each part that isn't valid is the default's.
 */
export function parseRedactSettings(saved: unknown): RedactSettings {
	if (typeof saved !== "object" || saved === null) {
		return defaultRedactSettings;
	}
	const fields = saved as Record<string, unknown>;
	const indexOf = (
		key: "strength" | "brushSize" | "eraserSize",
		count: number,
	) => {
		const index = fields[key];
		return typeof index === "number" &&
			Number.isInteger(index) &&
			index >= 0 &&
			index < count
			? index
			: defaultRedactSettings[key];
	};
	return {
		tool: REDACT_TOOLS.find((tool) => tool === fields.tool) ?? "box",
		effect: EFFECTS.find((effect) => effect === fields.effect) ?? "solid",
		color: isHexColor(fields.color)
			? fields.color
			: defaultRedactSettings.color,
		strength: indexOf("strength", BLUR_STRENGTHS.length),
		brushSize: indexOf("brushSize", REDACT_BRUSH_SIZES.length),
		eraserSize: indexOf("eraserSize", REDACT_BRUSH_SIZES.length),
	};
}

/** The effect the settings redact with on a canvas of `size`. */
export function redactionEffect(
	settings: RedactSettings,
	size: Size,
): RedactionEffect {
	switch (settings.effect) {
		case "solid":
			return { type: "solid", color: settings.color };
		case "blur":
			return {
				type: "blur",
				radius: BLUR_STRENGTHS[settings.strength] * shortSide(size),
			};
		case "pixelate":
			return {
				type: "pixelate",
				size: PIXEL_SIZES[settings.strength] * shortSide(size),
			};
	}
}

/**
 * What the brush or eraser paints with on a canvas of `size`, or null when
 * the tool drags boxes.
 */
export function maskBrush(
	settings: RedactSettings,
	size: Size,
): Omit<MaskStroke, "points"> | null {
	if (settings.tool === "box") return null;
	const index =
		settings.tool === "brush" ? settings.brushSize : settings.eraserSize;
	return {
		type: settings.tool === "brush" ? "pen" : "eraser",
		width: REDACT_BRUSH_SIZES[index] * shortSide(size),
	};
}

/**
 * The settings showing an existing redaction's effect: its color, or the
 * strength closest to its blur or pixels, on a canvas of `size`.
 */
export function withEffect(
	settings: RedactSettings,
	effect: RedactionEffect,
	size: Size,
): RedactSettings {
	if (effect.type === "solid") {
		return { ...settings, effect: "solid", color: effect.color };
	}
	const [strengths, value] =
		effect.type === "blur"
			? [BLUR_STRENGTHS, effect.radius]
			: [PIXEL_SIZES, effect.size];
	const share = value / shortSide(size);
	let strength = 0;
	strengths.forEach((candidate, index) => {
		if (Math.abs(candidate - share) < Math.abs(strengths[strength] - share)) {
			strength = index;
		}
	});
	return { ...settings, effect: effect.type, strength };
}

/** Whether two settings redact alike, whatever they paint with. */
export function sameEffect(left: RedactSettings, right: RedactSettings) {
	return (
		left.effect === right.effect &&
		(left.effect === "solid"
			? left.color === right.color
			: left.strength === right.strength)
	);
}
