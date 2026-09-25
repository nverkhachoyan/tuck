import { layerBounds } from "@/layers/layerBounds";
import type { EditorDocument } from "@/model/document";
import type { LayerTarget } from "./hitTest";

// Minimum comfortable touch padding around a layer, in screen pixels.
const HIT_PADDING_PX = 14;

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
				drawing: layer.type === "drawing" && !layer.locked ? layer : null,
				clipped: layer.type === "image" && layer.locked,
			};
		});
}
