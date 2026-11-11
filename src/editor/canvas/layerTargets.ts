import { assertNever } from "../document/assertNever";
import type { EditorDocument } from "../document/document";
import type { Layer } from "../layers/layer";
import { isLine } from "../layers/shape/shape";
import { shapeOutline } from "../layers/shape/shapeGeometry";
import type { MaskStroke } from "../layers/strokes";
import type { ResizeMode } from "./handleGeometry";
import { HIT_PADDING_PX, type LayerTarget } from "./hitTest";
import { layerBounds } from "./layerBounds";

/**
 * The document's visible layers, bottom to top. `viewScale` is screen pixels
 * per document unit, and must be above 0.
 */
export function layerTargets(
	document: EditorDocument,
	viewScale: number,
): LayerTarget[] {
	return document.layers
		.filter((layer) => !layer.hidden)
		.map((layer) => {
			const hitPadding = HIT_PADDING_PX / (viewScale * layer.transform.scaleX);
			return {
				id: layer.id,
				transform: layer.transform,
				box: layerBounds(layer),
				hitBox: layer.locked ? null : layerBounds(layer, hitPadding),
				hitPadding,
				strokes: layer.locked ? null : layerStrokes(layer),
				clipped: isClippedToCanvas(layer),
				resizeMode: resizeMode(layer),
				anchored: isAnchored(layer),
			};
		});
}

function isClippedToCanvas(layer: Layer): boolean {
	switch (layer.type) {
		case "image":
			return layer.locked;
		case "text":
		case "drawing":
		case "redaction":
		case "shape":
			return false;
		default:
			return assertNever(layer);
	}
}

function isAnchored(layer: Layer): boolean {
	switch (layer.type) {
		case "redaction":
			return true;
		case "image":
		case "text":
		case "drawing":
		case "shape":
			return false;
		default:
			return assertNever(layer);
	}
}

/**
 * How the layer's selection handles resize it, if they should: a
 * redaction's box or a shape's, whose proportions mean nothing, by its
 * sides; a line by its ends; and an image or text by stretching, once set to.
 */
export function resizeMode(layer: Layer): ResizeMode {
	switch (layer.type) {
		case "redaction":
			return layer.shape === "box" ? "box" : "none";
		case "shape":
			return isLine(layer) ? "endpoints" : "box";
		case "image":
		case "text":
			return layer.resizable ? "stretch" : "none";
		case "drawing":
			return "none";
		default:
			return assertNever(layer);
	}
}

function layerStrokes(layer: Layer): MaskStroke[] | null {
	switch (layer.type) {
		case "drawing":
			return layer.strokes;
		case "redaction":
			return layer.shape === "strokes" ? layer.strokes : null;
		case "shape":
			return shapeOutline(layer);
		case "image":
		case "text":
			return null;
		default:
			return assertNever(layer);
	}
}
