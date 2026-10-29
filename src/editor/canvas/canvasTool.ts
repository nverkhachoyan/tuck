import type { Point, Rect } from "../document/geometry.ts";
import {
	type Brush,
	layerBlend,
	strokeBlend,
} from "../layers/drawing/drawing.ts";
import type { CutStroke } from "../layers/image/image.ts";
import type { Layer } from "../layers/layer.ts";
import type { RedactionEffect } from "../layers/redaction/redaction.ts";
import type {
	ShapeKind,
	ShapePlacement,
	ShapeStyle,
} from "../layers/shape/shape.ts";
import type { MaskStroke } from "../layers/strokes.ts";
import type { Handle } from "./handleGeometry.ts";

/**
 * What dragging on the canvas does in place of moving layers: draws with a
 * brush, drags out a shape or a redaction's box, paints a redaction's
 * strokes, picks a color where the finger lifts, paints the cut of the image
 * `layerId`, or picks the subject to cut out of it with a tap.
 */
export type CanvasTool =
	| { type: "draw"; brush: Brush }
	| { type: "drawShape"; shape: ShapeKind; style: ShapeStyle }
	| { type: "pickColor" }
	| { type: "redactBox"; effect: RedactionEffect }
	| {
			type: "redactBrush";
			brush: Omit<MaskStroke, "points">;
			effect: RedactionEffect;
	  }
	| { type: "cutBrush"; layerId: string; brush: Omit<CutStroke, "points"> }
	| { type: "pickSubject"; layerId: string };

/**
 * A finished stroke with a tool: the tool, with what the stroke made, in
 * document space: a brush's points, a redaction's box, a shape's placement,
 * or the point picked.
 */
export type ToolStroke =
	| (Extract<CanvasTool, { type: "draw" | "redactBrush" | "cutBrush" }> & {
			points: number[];
	  })
	| (Extract<CanvasTool, { type: "redactBox" }> & { rect: Rect })
	| (Extract<CanvasTool, { type: "drawShape" }> & {
			placement: ShapePlacement;
	  })
	| (Extract<CanvasTool, { type: "pickColor" | "pickSubject" }> & {
			point: Point;
	  });

// What the canvas's gestures ask about a point from the view. The hooks that
// handle a tap, a stroke, or a hover take this instead of the viewport, the
// targets, and the selection each.
export type CanvasLookups = {
	handleAt: (screenX: number, screenY: number) => Handle | null;
	layerAt: (screenX: number, screenY: number) => string | null;
	toDocument: (screenX: number, screenY: number) => Point;
	tapAway: (point: Point) => void;
};

// What each kind's stroke does to the layer selected: whether it drags out
// a new one in place of moving that one, and the kind of layer whose style
// it shows and changes.
const CANVAS_TOOLS: Record<
	CanvasTool["type"],
	{ dragsOut: boolean; restyles: "redaction" | "shape" | null }
> = {
	draw: { dragsOut: false, restyles: null },
	drawShape: { dragsOut: true, restyles: "shape" },
	pickColor: { dragsOut: false, restyles: null },
	redactBox: { dragsOut: true, restyles: "redaction" },
	redactBrush: { dragsOut: false, restyles: "redaction" },
	cutBrush: { dragsOut: false, restyles: null },
	pickSubject: { dragsOut: false, restyles: null },
};

/**
 * Whether `tool` moves `layer` when it's selected: one it drags out, a
 * redaction or a shape, and not locked.
 */
export function drags(tool: CanvasTool, layer: Layer | undefined): boolean {
	return (
		!layer?.locked && CANVAS_TOOLS[tool.type].dragsOut && restyles(tool, layer)
	);
}

/** Whether `tool`'s style shows, and changes, `layer`'s: a redaction's or a shape's. */
export function restyles(
	tool: CanvasTool,
	layer: Layer | undefined,
): layer is Layer {
	return layer?.type === CANVAS_TOOLS[tool.type].restyles;
}

/** Whether `tool`'s strokes join `layer`, rather than starting a new one. */
export function canAddTo(tool: CanvasTool, layer: Layer): boolean {
	if (layer.locked) return false;
	switch (tool.type) {
		case "draw":
			return (
				layer.type === "drawing" &&
				(tool.brush.type === "eraser" ||
					strokeBlend(tool.brush) === layerBlend(layer))
			);
		case "redactBrush":
			return layer.type === "redaction" && layer.shape === "strokes";
		case "redactBox":
		case "drawShape":
		case "pickColor":
		case "cutBrush":
		case "pickSubject":
			return false;
	}
}

/** The image a cut paints or picks a subject in, or null. */
export function cutImageId(tool: CanvasTool | null): string | null {
	return tool && "layerId" in tool ? tool.layerId : null;
}
