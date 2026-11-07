import { isFields } from "../../document/values.ts";
import { createLayerId, identityTransform, type LayerBase } from "../base.ts";
import {
	drawingBox,
	isMaskStroke,
	nearLine,
	recenterDrawing,
	segmentsNear,
} from "../strokes.ts";

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

export type PenBrush = Extract<Brush, { type: "pen" }>;

// `points` is flattened x, y pairs, which keeps saved projects small.
export type Stroke = Brush & { points: number[] };

// A neon stroke's blurred glow, as shares of its width: the glow's own width
// and its blur's sigma. `DrawingLayerView` draws it; erasing measures it.
export const NEON_GLOW = 0.55;
export const NEON_GLOW_BLUR = 0.16;

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

/**
 * How far a pen stroke's ink reaches from its line: half its width for a
 * round pen, to the corners of a marker's or highlighter's square ends, and
 * to where a neon glow's blur fades out (three sigmas).
 */
export function visibleReach(stroke: Brush): number {
	if (stroke.type !== "pen" || stroke.tip === undefined)
		return stroke.width / 2;
	if (stroke.tip === "neon") {
		return stroke.width * (NEON_GLOW / 2 + 3 * NEON_GLOW_BLUR);
	}
	return stroke.width * Math.SQRT1_2;
}

/**
 * A mark's style: its last pen stroke's tip, color, and width, in the
 * layer's own space. Null for a drawing with no pen strokes.
 */
export function markStyle(layer: DrawingLayer): PenBrush | null {
	for (let i = layer.strokes.length - 1; i >= 0; i--) {
		const stroke = layer.strokes[i];
		if (stroke.type === "pen") {
			const { color, width, tip } = stroke;
			return tip === undefined
				? { type: "pen", color, width }
				: { type: "pen", color, width, tip };
		}
	}
	return null;
}

/**
 * Whether a drawing needs a saved layer of its own to draw right: to keep
 * an eraser's clear to its own ink, or to multiply as a whole. Plain ink
 * draws the same straight onto the canvas, since each stroke is
 * source-over and the layer would composite at full strength, and each
 * saved layer costs a render pass however small (measured in #88).
 */
export function needsOwnLayer(layer: DrawingLayer): boolean {
	return (
		layerBlend(layer) === "multiply" ||
		layer.strokes.some((stroke) => stroke.type === "eraser")
	);
}

// Past what a stroke's box covers, for antialiasing, in the layer's units.
const EDGE = 2;

/**
 * The rectangle a drawing's ink can reach in its own space: its strokes'
 * box, padded by how far past half its width a pen reaches (square ends,
 * a neon glow), and a little for antialiasing. A saved layer clipped to it
 * costs the drawing's size rather than the canvas's.
 */
export function inkRect(layer: DrawingLayer): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const { halfWidth, halfHeight } = drawingBox(layer);
	let pad = EDGE;
	for (const stroke of layer.strokes) {
		if (stroke.type === "pen") {
			pad = Math.max(pad, visibleReach(stroke) - stroke.width / 2 + EDGE);
		}
	}
	return {
		x: -halfWidth - pad,
		y: -halfHeight - pad,
		width: 2 * (halfWidth + pad),
		height: 2 * (halfHeight + pad),
	};
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function boundsOf(points: number[], pad: number): Bounds {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < points.length; i += 2) {
		minX = Math.min(minX, points[i]);
		maxX = Math.max(maxX, points[i]);
		minY = Math.min(minY, points[i + 1]);
		maxY = Math.max(maxY, points[i + 1]);
	}
	return {
		minX: minX - pad,
		minY: minY - pad,
		maxX: maxX + pad,
		maxY: maxY + pad,
	};
}

function overlaps(a: Bounds, b: Bounds): boolean {
	return (
		a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
	);
}

// Each point along a line, at steps no longer than `gap`, ends included.
function eachAlong(
	points: number[],
	gap: number,
	visit: (x: number, y: number) => boolean,
): boolean {
	if (!visit(points[0], points[1])) return false;
	for (let i = 2; i < points.length; i += 2) {
		const fromX = points[i - 2];
		const fromY = points[i - 1];
		const dx = points[i] - fromX;
		const dy = points[i + 1] - fromY;
		const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / gap));
		for (let step = 1; step <= steps; step++) {
			if (!visit(fromX + (dx * step) / steps, fromY + (dy * step) / steps)) {
				return false;
			}
		}
	}
	return true;
}

// Whether later erasers clear every bit of the pen `strokes[index]`'s ink:
// each sample along its line is within one eraser's reach less the ink's.
function erasedAway(strokes: Stroke[], index: number): boolean {
	const pen = strokes[index];
	const reach = visibleReach(pen);
	const penBounds = boundsOf(pen.points, reach);
	const erasers = strokes
		.slice(index + 1)
		.filter(
			(stroke) =>
				stroke.type === "eraser" &&
				stroke.width / 2 > reach &&
				overlaps(penBounds, boundsOf(stroke.points, stroke.width / 2)),
		);
	if (erasers.length === 0) return false;
	return eachAlong(pen.points, pen.width / 4, (x, y) =>
		erasers.some((eraser) =>
			nearLine(eraser.points, { x, y }, eraser.width / 2 - reach),
		),
	);
}

const noTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

// Whether the eraser `strokes[index]` passes over any pen's ink before it.
function erasesAnything(strokes: Stroke[], index: number): boolean {
	const eraser = strokes[index];
	const half = eraser.width / 2;
	const eraserBounds = boundsOf(eraser.points, half);
	return strokes.slice(0, index).some((pen) => {
		if (pen.type !== "pen") return false;
		const reach = visibleReach(pen);
		if (!overlaps(eraserBounds, boundsOf(pen.points, reach))) return false;
		// Half a step more, as the eraser is sampled at steps of `half`.
		return segmentsNear(eraser.points, noTransform, half, (point) =>
			nearLine(pen.points, point, half * 1.5 + reach),
		);
	});
}

/**
 * A drawing's strokes without what erasing has made pointless, in its own
 * space:
 * - a pen stroke later erasers clear entirely, sample by sample;
 * - then an eraser stroke that passes over no pen stroke before it.
 * It errs toward keeping: an eraser clears a pen's ink only where it's
 * wider than the ink there. The same array when nothing goes.
 */
export function pruneErased(strokes: Stroke[]): Stroke[] {
	const pens = strokes.filter(
		(stroke, index) => stroke.type !== "pen" || !erasedAway(strokes, index),
	);
	const kept = pens.filter(
		(stroke, index) => stroke.type !== "eraser" || erasesAnything(pens, index),
	);
	return kept.length === strokes.length ? strokes : kept;
}
