import type { Size } from "../editor/core.ts";

// Larger photos are scaled down to this many pixels on import so 48MP and
// larger camera modes don't exceed storage limits. iPhone's default 24MP
// photos are 5712×4284, a little over 24 million pixels, and fit as they are.
export const MAX_PHOTO_PIXELS = 25_000_000;

/**
 * The longest side an image preview may have. A photo larger than this is
 * scaled down for the canvas while keeping the full file for export.
 */
export const PREVIEW_LONG_SIDE = 4096;

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
