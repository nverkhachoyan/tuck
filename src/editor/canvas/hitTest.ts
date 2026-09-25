import { layerBounds } from "@/layers/layerBounds";
import type { EditorDocument } from "@/model/document";
import { hitTestDrawing } from "@/model/drawing";
import { hitTestBox, type Point, toLayerSpace } from "@/model/geometry";

// Minimum comfortable touch padding around a layer, in screen pixels.
const HIT_PADDING_PX = 14;

/**
 * Returns the id of the topmost selectable layer under a document-space
 * point, or null. Locked and hidden layers aren't selectable. `viewScale`
 * (screen pixels per document unit) keeps small layers comfortably tappable
 * on screen. A drawing is only hit near what it drew, so a tap inside a
 * circle drawn around something reaches what's under it.
 */
export function findLayerAt(
	document: EditorDocument,
	point: Point,
	viewScale: number,
): string | null {
	for (let i = document.layers.length - 1; i >= 0; i--) {
		const layer = document.layers[i];
		if (layer.hidden || layer.locked) continue;
		const padding = HIT_PADDING_PX / (viewScale * layer.transform.scaleX);
		const box = layerBounds(layer, padding);
		if (!hitTestBox(layer.transform, box, point)) continue;
		if (
			layer.type !== "drawing" ||
			hitTestDrawing(layer, toLayerSpace(layer.transform, point), padding)
		) {
			return layer.id;
		}
	}
	return null;
}
