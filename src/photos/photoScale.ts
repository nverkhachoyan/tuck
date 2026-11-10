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

// Looks the same as 1, at about half the size on disk. Export uses 0.95.
export const JPEG_QUALITY = 0.92;

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

/** The size of an imported photo after applying `MAX_PHOTO_PIXELS` and the side limits. */
export function scaledPhotoSize(
	photo: Size,
	maxShortSide?: number,
	maxLongSide?: number,
): Size {
	const scale = photoScale(photo, MAX_PHOTO_PIXELS, maxShortSide, maxLongSide);
	if (scale >= 1) return { width: photo.width, height: photo.height };
	return {
		width: Math.floor(photo.width * scale),
		height: Math.floor(photo.height * scale),
	};
}

/**
 * The size of a photo's canvas preview when its longer side exceeds
 * `PREVIEW_LONG_SIDE`, or null when the photo itself is small enough.
 */
export function previewSize(photo: Size): Size | null {
	const scale = photoScale(
		photo,
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		PREVIEW_LONG_SIDE,
	);
	if (scale >= 1) return null;
	return {
		width: Math.floor(photo.width * scale),
		height: Math.floor(photo.height * scale),
	};
}
