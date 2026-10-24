import {
	addMaskStroke,
	type CutStroke,
	isCutOut,
	withInvertedCut,
	withMask,
} from "../cutout.ts";
import { type EditorDocument, findLayer, replaceLayer } from "../document.ts";

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
