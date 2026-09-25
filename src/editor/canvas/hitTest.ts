import { layerBounds } from "@/layers/layerBounds";
import type { DrawingLayer, EditorDocument } from "@/model/document";
import { hitTestDrawing } from "@/model/drawing";
import {
	type Box,
	hitTestBox,
	type Point,
	type Transform,
	toLayerSpace,
} from "@/model/geometry";

// Minimum comfortable touch padding around a layer, in screen pixels.
const HIT_PADDING_PX = 14;

/**
 * What gestures need to know about a visible layer on the UI thread, where
 * text can't be laid out: where it is, its selection box, and where a touch
 * selects it. Built on the JS thread whenever the document or the view's
 * scale changes, and hit-tested on either thread.
 */
export type LayerTarget = {
	id: string;
	transform: Transform;
	box: Box;
	// The box a touch hits, padded so small layers stay tappable; null when
	// the layer is locked and can't be selected.
	hitBox: Box | null;
	hitPadding: number;
	// A drawing is only hit near what it drew.
	drawing: DrawingLayer | null;
	// A locked photo is cut off at the canvas's edge.
	clipped: boolean;
};

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

/**
 * The topmost selectable layer under a document-space point, or null. A
 * drawing is only hit near what it drew, so a tap inside a circle drawn
 * around something reaches what's under it.
 */
export function findLayerAt(
	targets: readonly LayerTarget[],
	point: Point,
): LayerTarget | null {
	"worklet";
	for (let i = targets.length - 1; i >= 0; i--) {
		const target = targets[i];
		if (!target.hitBox || !hitTestBox(target.transform, target.hitBox, point))
			continue;
		if (
			!target.drawing ||
			hitTestDrawing(
				target.drawing,
				toLayerSpace(target.transform, point),
				target.hitPadding,
			)
		) {
			return target;
		}
	}
	return null;
}
