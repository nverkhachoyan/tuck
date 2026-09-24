// Relative `.ts` import keeps this loadable by Node's test runner.
import type { Size } from "../model/geometry.ts";

/**
 * How much to shrink a photo so it has at most `maxPixels` pixels and its
 * shorter side is at most `maxShortSide`: 1 if it already fits.
 */
export function photoScale(
	photo: Size,
	maxPixels: number,
	maxShortSide = Number.POSITIVE_INFINITY,
): number {
	return Math.min(
		1,
		Math.sqrt(maxPixels / (photo.width * photo.height)),
		maxShortSide / Math.min(photo.width, photo.height),
	);
}
