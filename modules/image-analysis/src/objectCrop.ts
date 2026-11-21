import type { ImageBox, Rect, Size } from "./ImageAnalysis.types";

/** Side length of MobileSAM's square image encoder input, in pixels. */
export const ENCODER_SIDE = 1024;
/** Margin added on every side of a box, as a fraction of its longer side. */
export const CROP_PAD = 0.1;
/** Skip crop re-encoding when the padded crop's longer side exceeds this share of the photo's. */
export const MAX_CROP_SHARE = 0.5;
/** Minimum crop longer side in source pixels to avoid degenerate upscaling. */
export const MIN_CROP_PIXELS = 16;
/** Longer-side cap of the full-image mask produced from a crop decode. */
export const REFINED_MASK_MAX_SIDE = 2048;

/**
 * Geometry for decoding a small boxed object on a crop from the full-resolution
 * photo and pasting it into a full-image mask.
 * - `output`: dimensions of the returned full-image mask.
 * - `paste`: integer pixel rectangle inside `output` covered by the crop.
 * - `source`: matching crop rectangle in upright source-photo pixels.
 * - `encode`: dimensions to scale `source` to before padding to `ENCODER_SIDE`.
 * - `promptBox`: `[left, top, right, bottom]` inside `encode`.
 */
export type ObjectCropPlan = {
	output: Size;
	paste: Rect;
	source: Rect;
	encode: Size;
	promptBox: [number, number, number, number];
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Computes how to crop, encode, decode, and paste back a mask for `box` (normalized
 * to `[0, 1]`) on a photo of size `source`, or `null` when the object is already
 * large enough on the whole-image pass or the box is degenerate.
 */
export function planObjectCrop(
	source: Size,
	box: ImageBox,
): ObjectCropPlan | null {
	if (
		source.width <= 0 ||
		source.height <= 0 ||
		box.width <= 0 ||
		box.height <= 0
	) {
		return null;
	}

	const boxLeft = box.x * source.width;
	const boxTop = box.y * source.height;
	const boxWidth = box.width * source.width;
	const boxHeight = box.height * source.height;
	const pad = Math.max(boxWidth, boxHeight) * CROP_PAD;

	const leftPx = clamp(boxLeft - pad, 0, source.width);
	const topPx = clamp(boxTop - pad, 0, source.height);
	const rightPx = clamp(boxLeft + boxWidth + pad, 0, source.width);
	const bottomPx = clamp(boxTop + boxHeight + pad, 0, source.height);

	const rawWidth = rightPx - leftPx;
	const rawHeight = bottomPx - topPx;
	const sourceLong = Math.max(source.width, source.height);
	const cropLong = Math.max(rawWidth, rawHeight);
	if (cropLong < MIN_CROP_PIXELS || cropLong / sourceLong > MAX_CROP_SHARE) {
		return null;
	}

	const outScale = Math.min(1, REFINED_MASK_MAX_SIDE / sourceLong);
	const outWidth = Math.max(1, Math.round(source.width * outScale));
	const outHeight = Math.max(1, Math.round(source.height * outScale));

	const pasteX = clamp(
		Math.floor((leftPx / source.width) * outWidth),
		0,
		outWidth - 1,
	);
	const pasteY = clamp(
		Math.floor((topPx / source.height) * outHeight),
		0,
		outHeight - 1,
	);
	const pasteRight = clamp(
		Math.ceil((rightPx / source.width) * outWidth),
		pasteX + 1,
		outWidth,
	);
	const pasteBottom = clamp(
		Math.ceil((bottomPx / source.height) * outHeight),
		pasteY + 1,
		outHeight,
	);
	const pasteWidth = pasteRight - pasteX;
	const pasteHeight = pasteBottom - pasteY;

	// Derive the source crop and prompt box from the snapped paste rectangle so
	// crop image, decoder `orig_im_size`, and pasted mask share the same frame.
	const normLeft = pasteX / outWidth;
	const normTop = pasteY / outHeight;
	const normWidth = pasteWidth / outWidth;
	const normHeight = pasteHeight / outHeight;

	const sourceRect: Rect = {
		x: normLeft * source.width,
		y: normTop * source.height,
		width: normWidth * source.width,
		height: normHeight * source.height,
	};

	const encodeScale =
		ENCODER_SIDE / Math.max(sourceRect.width, sourceRect.height);
	const encodeWidth = Math.max(1, Math.round(sourceRect.width * encodeScale));
	const encodeHeight = Math.max(1, Math.round(sourceRect.height * encodeScale));

	const bx0 = clamp((box.x - normLeft) / normWidth, 0, 1) * encodeWidth;
	const by0 = clamp((box.y - normTop) / normHeight, 0, 1) * encodeHeight;
	const bx1 =
		clamp((box.x + box.width - normLeft) / normWidth, 0, 1) * encodeWidth;
	const by1 =
		clamp((box.y + box.height - normTop) / normHeight, 0, 1) * encodeHeight;

	return {
		output: { width: outWidth, height: outHeight },
		paste: { x: pasteX, y: pasteY, width: pasteWidth, height: pasteHeight },
		source: sourceRect,
		encode: { width: encodeWidth, height: encodeHeight },
		promptBox: [bx0, by0, bx1, by1],
	};
}
