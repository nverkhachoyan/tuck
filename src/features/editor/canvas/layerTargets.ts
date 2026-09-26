import { layerBounds } from "@/layers/layerBounds";
import type { EditorDocument, Layer, MaskStroke } from "@/model/document";
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
 * Whether dragging a layer's handles resizes its box, each side on its own,
 * rather than scaling it: a redaction's box, whose proportions mean nothing.
 */
export type ResizeMode = "none" | "box" | "stretch";

/** How the layer's selection handles resize it, if they should. */
export function resizeMode(layer: Layer): ResizeMode {
	if (layer.type === "redaction" && layer.shape === "box") return "box";
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
	return null;
}
