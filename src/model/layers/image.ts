import {
	type Adjustments,
	adjustmentsEqual,
	isAdjustments,
	isNeutral,
} from "../adjustments.ts";
import type { Rect, Size } from "../geometry.ts";
import { isMaskStroke, type MaskStroke } from "../strokes.ts";
import { isFields, isPositive } from "../values.ts";
import {
	areaTransform,
	canvasArea,
	createLayerId,
	type LayerBase,
} from "./base.ts";

/**
 * A stroke on an image's cut: a mask stroke whose edge fades over
 * `feather`, a blur's sigma in the same units as its width, to match a
 * found mask's soft edges. It's hard without one.
 */
export type CutStroke = MaskStroke & { feather?: number };

export function isCutStroke(value: unknown): boolean {
	return (
		isMaskStroke(value) &&
		isFields(value) &&
		(value.feather === undefined || isPositive(value.feather))
	);
}

// transform.x/y is the image's center in document space. `flipped` mirrors
// it within its own space, which keeps its transform's scale positive.
// `opaque` is whether every pixel is: photos are, a PNG may not be.
// `sticker` marks one added from the sticker sheet, which is only named
// differently: its file is copied into the project like a photo's.
// `adjustments` is left out while none are made. `mask`, when the subject
// has been cut out of the image, is a grayscale image file stretched over it:
// the image shows where the mask is white, and not where it's black. The
// image's own file is untouched, so the cut can be undone or taken back.
// `maskStrokes` refine the cut by hand, painted over the mask (or over the
// whole image, without one) in the image's own pixels, centered on its
// middle, before it's flipped: a pen shows the image, an eraser hides it.
// They're left out while there are none.
export type ImageLayer = LayerBase & {
	type: "image";
	uri: string;
	width: number;
	height: number;
	flipped: boolean;
	opaque: boolean;
	sticker?: boolean;
	adjustments?: Adjustments;
	mask?: string;
	maskStrokes?: CutStroke[];
};

// How much of the canvas a new image layer may take up, either way.
const NEW_IMAGE_FIT = 0.8;

// How far a new image layer can be enlarged past covering the canvas before
// it blurs.
const NEW_IMAGE_HEADROOM = 1.5;

/**
 * The longest a new image layer's shorter side is worth being, in pixels:
 * enough to cover the canvas turned either way, with `NEW_IMAGE_HEADROOM` to
 * spare. Past that, pixels only cost memory: the editor and export each hold
 * every image decoded in full.
 */
export function maxNewImageShortSide(canvas: Size): number {
	return Math.ceil(Math.max(canvas.width, canvas.height) * NEW_IMAGE_HEADROOM);
}

/**
 * A photo as a new layer, centered and shrunk to sit well inside `area` (the
 * canvas, or the part of it in view), but never enlarged past its own
 * pixels, which would blur it. It starts unlocked, so it moves on the canvas
 * and the crop tool doesn't frame it.
 */
export function createImageLayer(
	canvas: Size,
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
	area: Rect = canvasArea(canvas),
): ImageLayer {
	const scale = Math.min(
		1,
		(area.width * NEW_IMAGE_FIT) / width,
		(area.height * NEW_IMAGE_FIT) / height,
	);
	return {
		type: "image",
		id: createLayerId("image"),
		uri,
		width,
		height,
		flipped: false,
		opaque,
		transform: { ...areaTransform(area), scaleX: scale, scaleY: scale },
		hidden: false,
		locked: false,
	};
}

// How much of the canvas's shorter side a new sticker spans.
const NEW_STICKER_FIT = 0.3;

/**
 * A sticker's image as a new layer, centered on `area` (the canvas, or the
 * part of it in view) and sized to it rather than its pixels, so it looks
 * the same on a screenshot as on a large photo.
 */
export function createStickerLayer(
	canvas: Size,
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
	area: Rect = canvasArea(canvas),
): ImageLayer {
	const scale =
		(Math.min(area.width, area.height) * NEW_STICKER_FIT) /
		Math.max(width, height);
	return {
		...createImageLayer(canvas, uri, width, height, opaque),
		sticker: true,
		transform: { ...areaTransform(area), scaleX: scale, scaleY: scale },
	};
}

/**
 * `layer` with `adjustments`, left out when they change nothing, or `layer`
 * itself when its adjustments are the same already.
 */
export function withAdjustments(
	layer: ImageLayer,
	adjustments: Adjustments,
): ImageLayer {
	const current = layer.adjustments;
	if (isNeutral(adjustments)) {
		if (!current) return layer;
		const { adjustments: _, ...rest } = layer;
		return rest;
	}
	return current && adjustmentsEqual(current, adjustments)
		? layer
		: { ...layer, adjustments };
}

export function isImageLayer(value: unknown): boolean {
	return (
		isFields(value) &&
		value.type === "image" &&
		typeof value.uri === "string" &&
		isPositive(value.width) &&
		isPositive(value.height) &&
		typeof value.flipped === "boolean" &&
		typeof value.opaque === "boolean" &&
		(value.sticker === undefined || typeof value.sticker === "boolean") &&
		(value.adjustments === undefined || isAdjustments(value.adjustments)) &&
		(value.mask === undefined || typeof value.mask === "string") &&
		(value.maskStrokes === undefined ||
			(Array.isArray(value.maskStrokes) &&
				value.maskStrokes.length > 0 &&
				value.maskStrokes.every(isCutStroke)))
	);
}
