import { isFields } from "../../document/values.ts";

/**
 * An image layer's color adjustments, each from -1 to 1, where 0 leaves the
 * image unchanged. Temperature warms it (more red, less blue) above 0 and
 * cools it below.
 */
export type Adjustments = {
	brightness: number;
	contrast: number;
	saturation: number;
	temperature: number;
};

export type AdjustmentKey = keyof Adjustments;

export const adjustmentKeys = [
	"brightness",
	"contrast",
	"saturation",
	"temperature",
] as const satisfies readonly AdjustmentKey[];

export const neutralAdjustments: Adjustments = {
	brightness: 0,
	contrast: 0,
	saturation: 0,
	temperature: 0,
};

export function isAdjustments(value: unknown): boolean {
	return (
		isFields(value) &&
		adjustmentKeys.every((key) => {
			const amount = value[key];
			return typeof amount === "number" && Math.abs(amount) <= 1;
		})
	);
}

/**
 * A 4×5 color matrix, row-major: each output channel (R, G, B, A) is a
 * weighted sum of the input's, plus an offset in the last column, with
 * channels from 0 to 1. The layout Skia's `ColorMatrix` takes.
 */
export type ColorMatrix = number[];

// How far each adjustment goes at ±1: brightness shifts every channel by up
// to this much, and temperature scales red and blue by up to this much.
const BRIGHTNESS_SHIFT = 0.4;
const TEMPERATURE_GAIN = 0.25;
// Contrast scales around this gray, which it leaves where it is.
const CONTRAST_PIVOT = 0.5;
// Rec. 709 luma: the gray that saturation fades toward.
const LUMA = [0.2126, 0.7152, 0.0722];

export function isNeutral(adjustments: Adjustments): boolean {
	return adjustmentKeys.every((key) => adjustments[key] === 0);
}

export function adjustmentsEqual(left: Adjustments, right: Adjustments) {
	return adjustmentKeys.every((key) => left[key] === right[key]);
}

function clampUnit(value: number): number {
	"worklet";
	return Math.min(1, Math.max(-1, value));
}

function scaleMatrix(
	r: number,
	g: number,
	b: number,
	offset: number,
): ColorMatrix {
	"worklet";
	// biome-ignore format: a matrix reads best in rows
	return [
		r, 0, 0, 0, offset,
		0, g, 0, 0, offset,
		0, 0, b, 0, offset,
		0, 0, 0, 1, 0,
	];
}

function saturationMatrix(amount: number): ColorMatrix {
	"worklet";
	const fade = 1 - amount;
	const matrix: ColorMatrix = [];
	for (let row = 0; row < 3; row++) {
		for (let column = 0; column < 5; column++) {
			const luma = column < 3 ? fade * LUMA[column] : 0;
			matrix.push(luma + (row === column ? amount : 0));
		}
	}
	matrix.push(0, 0, 0, 1, 0);
	return matrix;
}

/** The matrix that applies `first`, then `then`. */
export function concatColorMatrices(
	then: ColorMatrix,
	first: ColorMatrix,
): ColorMatrix {
	"worklet";
	const result: ColorMatrix = [];
	for (let row = 0; row < 4; row++) {
		for (let column = 0; column < 5; column++) {
			let sum = column === 4 ? then[row * 5 + 4] : 0;
			for (let k = 0; k < 4; k++) {
				sum += then[row * 5 + k] * first[k * 5 + column];
			}
			result.push(sum);
		}
	}
	return result;
}

/**
 * The one color matrix that applies `adjustments`: temperature first, as a
 * white balance would, then brightness, contrast, and saturation. Alpha is
 * left alone, so transparent pixels stay transparent.
 */
export function adjustmentMatrix(adjustments: Adjustments): ColorMatrix {
	"worklet";
	const temperature = clampUnit(adjustments.temperature) * TEMPERATURE_GAIN;
	const brightness = clampUnit(adjustments.brightness) * BRIGHTNESS_SHIFT;
	const contrast = 1 + clampUnit(adjustments.contrast);
	const saturation = 1 + clampUnit(adjustments.saturation);
	const steps = [
		scaleMatrix(1 + temperature, 1, 1 - temperature, 0),
		scaleMatrix(1, 1, 1, brightness),
		scaleMatrix(contrast, contrast, contrast, CONTRAST_PIVOT * (1 - contrast)),
		saturationMatrix(saturation),
	];
	let matrix = steps[0];
	for (let i = 1; i < steps.length; i++) {
		matrix = concatColorMatrices(steps[i], matrix);
	}
	return matrix;
}
