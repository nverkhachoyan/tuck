import { layerBounds } from "@/layers/layerBounds";
import {
	type EditorDocument,
	isLine,
	type Layer,
	type MaskStroke,
} from "@/model/document";
import { shapeOutline } from "@/model/shapes";
import type { ResizeMode } from "../handles/handleGeometry";
import type { LayerTarget } from "./hitTest";

// Minimum comfortable touch padding around a layer, in screen pixels.
export const HIT_PADDING_PX = 14;

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
				clipped: layer.type === "image" && layer.locked,
				resizeMode: resizeMode(layer),
			};
		});
}

/**
 * How the layer's selection handles resize it, if they should: a
 * redaction's box or a shape's, whose proportions mean nothing, by its
 * sides; a line by its ends; and an image or text by stretching, once set to.
 */
export function resizeMode(layer: Layer): ResizeMode {
	if (layer.type === "redaction" && layer.shape === "box") return "box";
	if (layer.type === "shape") return isLine(layer) ? "endpoints" : "box";
	if ((layer.type === "image" || layer.type === "text") && layer.resizable) {
		return "stretch";
	}
	return "none";
}

function layerStrokes(layer: Layer): MaskStroke[] | null {
	if (layer.type === "drawing") return layer.strokes;
	if (layer.type === "redaction" && layer.shape === "strokes") {
		return layer.strokes;
	}
	if (layer.type === "shape") return shapeOutline(layer);
	return null;
}
