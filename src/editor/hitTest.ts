import { layerBounds } from "@/layers/layerBounds";
import type { EditorDocument } from "@/model/document";
import { hitTestBox, type Point } from "@/model/geometry";

// Minimum comfortable touch padding around a layer, in screen pixels.
const HIT_PADDING_PX = 14;

/**
 * Returns the id of the topmost selectable layer under a document-space
 * point, or null. The pinned photo and hidden layers aren't selectable.
 * `viewScale` (screen pixels per document unit) keeps small layers
 * comfortably tappable on screen.
 */
export function findLayerAt(
	document: EditorDocument,
	point: Point,
	viewScale: number,
): string | null {
	for (let i = document.layers.length - 1; i > 0; i--) {
		const layer = document.layers[i];
		if (layer.hidden) continue;
		const box = layerBounds(
			layer,
			HIT_PADDING_PX / (viewScale * layer.transform.scaleX),
		);
		if (hitTestBox(layer.transform, box, point)) {
			return layer.id;
		}
	}
	return null;
}
