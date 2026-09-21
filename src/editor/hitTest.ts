import { layoutTextLayer, selectionPadding } from "@/layers/textLayerLayout";
import type { EditorDocument } from "@/model/document";
import { hitTestBox, type Point } from "@/model/geometry";

// Minimum comfortable touch padding around text, in screen pixels.
const HIT_PADDING_PX = 14;

/**
 * Returns the id of the topmost selectable layer under a document-space
 * point, or null. `viewScale` (screen pixels per document unit) keeps small
 * text comfortably tappable on screen.
 */
export function findLayerAt(
	document: EditorDocument,
	point: Point,
	viewScale: number,
): string | null {
	for (let i = document.layers.length - 1; i >= 0; i--) {
		const layer = document.layers[i];
		if (layer.type !== "text") continue;
		const { width, height } = layoutTextLayer(layer);
		const hitPad = Math.max(
			selectionPadding(layer),
			HIT_PADDING_PX / (viewScale * layer.transform.scaleX),
		);
		if (
			hitTestBox(
				layer.transform,
				width / 2 + hitPad,
				height / 2 + hitPad,
				point,
			)
		) {
			return layer.id;
		}
	}
	return null;
}
