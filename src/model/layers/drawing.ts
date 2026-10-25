import { isMaskStroke, recenterDrawing } from "../strokes.ts";
import { isFields } from "../values.ts";
import { createLayerId, identityTransform, type LayerBase } from "./base.ts";

// A pen's tip, when it isn't a plain round one. `marker` multiplies like a
// highlighter, `ink` is the see-through marker, and `neon` glows.
// Named for how they look; `DrawingLayerView` draws each.
export const penTips = ["marker", "ink", "neon"] as const;
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

export function isStroke(value: unknown): boolean {
	return (
		isMaskStroke(value) &&
		isFields(value) &&
		(value.type === "eraser" ||
			(typeof value.color === "string" &&
				(value.tip === undefined || penTips.some((tip) => tip === value.tip))))
	);
}

// Strokes are in the layer's own space, centered on what its pens drew (see
// `recenterDrawing`), so its transform places it like any other layer.
export type DrawingLayer = LayerBase & {
	type: "drawing";
	strokes: Stroke[];
	// How the whole layer composites onto what's under it. Absent draws
	// normally. Anything else is ignored, so a newer blend still opens.
	blend?: "multiply";
};

/** The blend a stroke starts its layer with. Only a highlighter multiplies. */
export function strokeBlend(stroke: Brush): "multiply" | undefined {
	return stroke.type === "pen" && stroke.tip === "marker"
		? "multiply"
		: undefined;
}

/** `multiply` when the layer says so. Any other saved value draws normally. */
export function layerBlend(layer: { blend?: unknown }): "multiply" | undefined {
	return layer.blend === "multiply" ? "multiply" : undefined;
}

/**
 * A drawing begun by a pen stroke in document space. An eraser can't start
 * one: there's nothing to erase yet.
 */
export function createDrawingLayer(
	stroke: Stroke & { type: "pen" },
): DrawingLayer {
	const blend = strokeBlend(stroke);
	return recenterDrawing({
		type: "drawing",
		id: createLayerId("drawing"),
		strokes: [stroke],
		...(blend ? { blend } : {}),
		transform: identityTransform,
		hidden: false,
		locked: false,
	});
}

export function isDrawingLayer(value: unknown): boolean {
	return (
		isFields(value) &&
		value.type === "drawing" &&
		Array.isArray(value.strokes) &&
		value.strokes.every(isStroke)
	);
}
