import {
	addLayerOnTop,
	createLayerGroup,
	type EditorDocument,
	findLayer,
	replaceLayer,
} from "../../document/document.ts";
import type { Rect } from "../../document/geometry.ts";
import { addStroke, type MaskStroke } from "../strokes.ts";
import {
	createMaskedRedaction,
	createPlacedRedactionBox,
	createRedactionBox,
	createRedactionStrokes,
	effectsEqual,
	type RedactionBoxPlacement,
	type RedactionEffect,
} from "./redaction.ts";

/** A box in document space, on top. */
export function addRedactionBox(
	document: EditorDocument,
	rect: Rect,
	effect: RedactionEffect,
): EditorDocument {
	if (rect.width <= 0 || rect.height <= 0) return document;
	return addLayerOnTop(document, createRedactionBox(rect, effect));
}

/**
 * Detector proposals, on top together. Their group is metadata over the flat
 * paint order, so a large result stays one compact row without adding a
 * canvas compositing layer.
 */
export function addRedactionBoxes(
	document: EditorDocument,
	placements: readonly RedactionBoxPlacement[],
	effect: RedactionEffect,
	groupName = "Find results",
): EditorDocument {
	const boxes = placements
		.filter(({ width, height }) => width > 0 && height > 0)
		.map((placement) => createPlacedRedactionBox(placement, effect));
	if (boxes.length === 0) return document;
	return {
		...document,
		layers: [...document.layers, ...boxes],
		groups: [
			...(document.groups ?? []),
			createLayerGroup(
				groupName,
				boxes.map((box) => box.id),
			),
		],
	};
}

/** Over the image it was selected on, on top. */
export function addMaskedRedaction(
	document: EditorDocument,
	imageId: string,
	mask: string,
	rect: Rect,
	effect: RedactionEffect,
): EditorDocument {
	const image = findLayer(document, imageId);
	if (image?.type !== "image" || rect.width <= 0 || rect.height <= 0) {
		return document;
	}
	return addLayerOnTop(
		document,
		createMaskedRedaction(image, mask, rect, effect),
	);
}

/**
 * A stroke joins the selected brushed redaction, or a pen starts a new one
 * with `effect` on top.
 */
export function paintRedaction(
	document: EditorDocument,
	selectedLayerId: string | null,
	stroke: MaskStroke,
	effect: RedactionEffect,
): EditorDocument {
	if (stroke.points.length < 2) return document;
	const selected = findLayer(document, selectedLayerId);
	if (
		selected?.type === "redaction" &&
		selected.shape === "strokes" &&
		!selected.locked
	) {
		return replaceLayer(document, selected, addStroke(selected, stroke));
	}
	if (stroke.type !== "pen") return document;
	return addLayerOnTop(
		document,
		createRedactionStrokes({ ...stroke, type: "pen" }, effect),
	);
}

export function setRedactionEffect(
	document: EditorDocument,
	id: string,
	effect: RedactionEffect,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "redaction" || effectsEqual(target.effect, effect)) {
		return document;
	}
	return replaceLayer(document, target, { ...target, effect });
}
