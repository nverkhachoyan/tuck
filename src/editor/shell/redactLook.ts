import { isHexColor } from "../../model/color.ts";
import type { Size } from "../../model/geometry.ts";
import type { RedactionEffect } from "../../model/layers/redaction.ts";

/**
 * How a new redaction looks, whichever tool adds it: Redact, Find, or Cut
 * out. `strength` indexes into `BLUR_STRENGTHS` or `PIXEL_SIZES`, whichever
 * the effect uses.
 */
export type RedactLook = {
	effect: RedactionEffect["type"];
	color: string;
	strength: number;
};

// Solid black: the one nothing can be read back from.
export const defaultRedactLook: RedactLook = {
	effect: "solid",
	color: "#000000",
	strength: 1,
};

// Blur sigmas and pixel sides as a share of the canvas's shorter side, so
// they look the same on a screenshot as on a camera photo. The lightest blur,
// and the smallest pixels, still leave text in a screenshot unreadable: a
// line of it is about two pixels tall.
export const BLUR_STRENGTHS = [0.008, 0.016, 0.03];
export const PIXEL_SIZES = [0.02, 0.035, 0.055];

export const shortSide = (size: Size) => Math.min(size.width, size.height);

const EFFECT_TYPES: RedactLook["effect"][] = ["solid", "blur", "pixelate"];

/** Whether `value` is an index into a list of `count`. */
export function isIndex(value: unknown, count: number): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 0 &&
		value < count
	);
}

/**
 * The look from what an earlier session saved, which may be from an older
 * build, or damaged: each part that isn't valid is the default's.
 */
export function parseRedactLook(saved: unknown): RedactLook {
	if (typeof saved !== "object" || saved === null) return defaultRedactLook;
	const { effect, color, strength } = saved as Record<string, unknown>;
	return {
		effect:
			EFFECT_TYPES.find((type) => type === effect) ?? defaultRedactLook.effect,
		color: isHexColor(color) ? color : defaultRedactLook.color,
		strength: isIndex(strength, BLUR_STRENGTHS.length)
			? strength
			: defaultRedactLook.strength,
	};
}

/** The effect `look` redacts with on a canvas of `size`. */
export function redactionEffect(look: RedactLook, size: Size): RedactionEffect {
	switch (look.effect) {
		case "solid":
			return { type: "solid", color: look.color };
		case "blur":
			return {
				type: "blur",
				radius: BLUR_STRENGTHS[look.strength] * shortSide(size),
			};
		case "pixelate":
			return {
				type: "pixelate",
				size: PIXEL_SIZES[look.strength] * shortSide(size),
			};
	}
}

/**
 * `look` showing an existing redaction's effect: its color, or the strength
 * closest to its blur or pixels, on a canvas of `size`.
 */
export function withEffect<T extends RedactLook>(
	look: T,
	effect: RedactionEffect,
	size: Size,
): T {
	if (effect.type === "solid") {
		return { ...look, effect: "solid", color: effect.color };
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
	return { ...look, effect: effect.type, strength };
}

/** Whether two looks redact alike. */
export function sameEffect(left: RedactLook, right: RedactLook) {
	return (
		left.effect === right.effect &&
		(left.effect === "solid"
			? left.color === right.color
			: left.strength === right.strength)
	);
}
