// Relative `.ts` import keeps this loadable by Node's test runner.
import type { Size } from "../model/geometry.ts";

// Larger photos are scaled down to this many pixels. The editor and export
// each hold the photo decoded in full, so 48MP and larger camera modes can run
// a phone out of memory. iPhone's default 24MP photos are 5712×4284, a little
// over 24 million pixels, and fit as they are.
export const MAX_PHOTO_PIXELS = 25_000_000;

/**
 * How much to shrink a photo so it has at most `maxPixels` pixels, its
 * shorter side is at most `maxShortSide`, and its longer at most
 * `maxLongSide`: 1 if it already fits.
 */
export function photoScale(
	photo: Size,
	maxPixels: number,
	maxShortSide = Number.POSITIVE_INFINITY,
	maxLongSide = Number.POSITIVE_INFINITY,
): number {
	return Math.min(
		1,
		Math.sqrt(maxPixels / (photo.width * photo.height)),
		maxShortSide / Math.min(photo.width, photo.height),
		maxLongSide / Math.max(photo.width, photo.height),
	);
}
