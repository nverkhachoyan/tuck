import { type Transform, transformsEqual } from "../geometry.ts";
import { drawingBox, type MaskStroke } from "../strokes.ts";
import { createLayerId } from "./base.ts";
import type { DrawingLayer } from "./drawing.ts";
import type { ImageLayer } from "./image.ts";
import type { RedactionLayer } from "./redaction.ts";
import { isLine, type ShapeLayer } from "./shape.ts";
import type { TextLayer } from "./text.ts";

export type Layer =
	| ImageLayer
	| TextLayer
	| DrawingLayer
	| RedactionLayer
	| ShapeLayer;

/**
 * The image files a layer draws: an image layer's image and mask, or a
 * masked redaction's mask.
 */
export function layerFiles(layer: Layer): string[] {
	if (layer.type === "image") {
		return layer.mask === undefined ? [layer.uri] : [layer.uri, layer.mask];
	}
	return layer.type === "redaction" && layer.shape === "mask"
		? [layer.mask]
		: [];
}

/**
 * A layer with a box its handles resize, resized to `width` by `height` with
 * its center (and, for a line, its angle) moved to `transform`: a
 * redaction's box, or a shape, whose length as a line is `width`. Null when
 * it has no such box, or nothing would change.
 */
export function resizeLayerBox(
	layer: Layer,
	transform: Transform,
	width: number,
	height: number,
): Layer | null {
	if (width <= 0 || height <= 0) return null;
	const moved = !transformsEqual(layer.transform, transform);
	if (layer.type === "shape" && isLine(layer)) {
		return moved || layer.length !== width
			? { ...layer, transform, length: width }
			: null;
	}
	if (
		layer.type === "shape" ||
		(layer.type === "redaction" && layer.shape === "box")
	) {
		return moved || layer.width !== width || layer.height !== height
			? { ...layer, transform, width, height }
			: null;
	}
	return null;
}

/**
 * A copy of a layer with a new id, nudged down and right so it's visibly
 * separate from the original instead of hiding it.
 */
export function duplicateLayer<T extends Layer>(layer: T): T {
	const offset = duplicateOffset(layer) * layer.transform.scaleX;
	return {
		...layer,
		id: createLayerId(layer.type),
		transform: {
			...layer.transform,
			x: layer.transform.x + offset,
			y: layer.transform.y + offset,
		},
	};
}

// In the layer's own units: half a line of text, a tenth of an image or a
// box, a tenth of a line shape's length, or a tenth of a drawing's longer
// side (a line drawn straight has no shorter one).
function duplicateOffset(layer: Layer): number {
	switch (layer.type) {
		case "text":
			return layer.fontSize * 0.5;
		case "image":
			return Math.min(layer.width, layer.height) * 0.1;
		case "drawing":
			return strokesOffset(layer);
		case "redaction":
			return layer.shape === "strokes"
				? strokesOffset(layer)
				: Math.min(layer.width, layer.height) * 0.1;
		case "shape":
			return isLine(layer)
				? layer.length * 0.1
				: Math.min(layer.width, layer.height) * 0.1;
	}
}

function strokesOffset(layer: { strokes: MaskStroke[] }): number {
	const { halfWidth, halfHeight } = drawingBox(layer);
	return Math.max(halfWidth, halfHeight) * 0.2;
}

/**
 * `layers` with one layer moved to `toIndex`, clamped to the stack. Returns
 * `layers` itself when nothing would change.
 */
export function reorderLayer(
	layers: Layer[],
	id: string,
	toIndex: number,
): Layer[] {
	const from = layers.findIndex((layer) => layer.id === id);
	const to = Math.min(Math.max(toIndex, 0), layers.length - 1);
	if (from < 0 || from === to) return layers;
	const next = layers.filter((layer) => layer.id !== id);
	next.splice(to, 0, layers[from]);
	return next;
}
