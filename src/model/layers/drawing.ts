import { recenterDrawing } from "../strokes.ts";
import { createLayerId, identityTransform, type LayerBase } from "./base.ts";

// A pen's tip, when it isn't a plain round one: a marker's flat, see-through
// ink, or a neon tube's glow. Named for how they look; `DrawingLayerView`
// draws each.
export const penTips = ["marker", "neon"] as const;
export type PenTip = (typeof penTips)[number];

/**
 * What a stroke draws with: a pen's color, or an eraser, which clears what
 * the drawing's earlier strokes drew. `width` is the line's thickness, glow
 * and all. A pen without a `tip` is a plain round one.
 */
export type Brush =
	| { type: "pen"; color: string; width: number; tip?: PenTip }
	| { type: "eraser"; width: number };

// `points` is flattened x, y pairs, which keeps saved projects small.
export type Stroke = Brush & { points: number[] };

// Strokes are in the layer's own space, centered on what its pens drew (see
// `recenterDrawing`), so its transform places it like any other layer.
export type DrawingLayer = LayerBase & {
	type: "drawing";
	strokes: Stroke[];
};

/**
 * A drawing begun by a pen stroke in document space. An eraser can't start
 * one: there's nothing to erase yet.
 */
export function createDrawingLayer(
	stroke: Stroke & { type: "pen" },
): DrawingLayer {
	return recenterDrawing({
		type: "drawing",
		id: createLayerId("drawing"),
		strokes: [stroke],
		transform: identityTransform,
		hidden: false,
		locked: false,
	});
}
