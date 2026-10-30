import {
	type EditorDocument,
	findLayer,
	replaceLayer,
	withLayers,
} from "../../document/document.ts";
import type { Adjustments } from "./adjustments.ts";
import { type CutStroke, type ImageLayer, withAdjustments } from "./image.ts";
import { addMaskStroke, isCutOut, withInvertedCut, withMask } from "./mask.ts";

export function setAdjustments(
	document: EditorDocument,
	id: string,
	adjustments: Adjustments,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "image") return document;
	return replaceLayer(document, target, withAdjustments(target, adjustments));
}

export function setMask(
	document: EditorDocument,
	id: string,
	mask: string | null,
	options?: { keepStrokes?: boolean },
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "image") return document;
	return replaceLayer(document, target, withMask(target, mask, options));
}

/**
 * `mask` is the inverse of the image's mask, so only an image that's cut has
 * one to invert.
 */
export function invertMask(
	document: EditorDocument,
	id: string,
	mask: string,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "image" || !isCutOut(target)) return document;
	return replaceLayer(document, target, withInvertedCut(target, mask));
}

/**
 * Keeping what's already whole changes nothing, so a pen on an uncut image
 * leaves the document be.
 */
export function paintMask(
	document: EditorDocument,
	id: string,
	stroke: CutStroke,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "image" || stroke.points.length < 2) return document;
	if (stroke.type === "pen" && !isCutOut(target)) return document;
	return replaceLayer(document, target, addMaskStroke(target, stroke));
}

/**
 * A copy of image `id`, as `copyId`, showing what `selection` (a cut's mask
 * and strokes) keeps of it, just above it and exactly over it. It starts
 * unlocked and shown, so it moves on the canvas whatever its source is. The
 * strokes are in the image's own pixels, so they fit the copy unchanged.
 */
export function addCutCopy(
	document: EditorDocument,
	id: string,
	selection: Pick<ImageLayer, "mask" | "maskStrokes">,
	copyId: string,
): EditorDocument {
	const index = document.layers.findIndex((layer) => layer.id === id);
	const source = document.layers[index];
	if (source?.type !== "image") return document;
	const { mask: _, maskStrokes: __, ...rest } = source;
	const { mask, maskStrokes } = selection;
	const copy: ImageLayer = {
		...rest,
		id: copyId,
		hidden: false,
		locked: false,
		...(mask === undefined ? {} : { mask }),
		...(maskStrokes === undefined ? {} : { maskStrokes }),
	};
	const { layers } = document;
	return withLayers(document, [
		...layers.slice(0, index + 1),
		copy,
		...layers.slice(index + 1),
	]);
}
