import { isFields } from "../../document/values.ts";
import { createLayerId, identityTransform, type LayerBase } from "../base.ts";
import {
	boxesOverlap,
	drawingBox,
	isMaskStroke,
	lineBox,
	nearLine,
	recenterDrawing,
	segmentsNear,
} from "../strokes.ts";

// A pen's tip, when it isn't a plain round one. `marker` multiplies like a
// highlighter, `ink` is the see-through marker, and `neon` glows.
// Named for how they look; `DrawingLayerView` draws each.
export const penTips = ["marker", "ink", "neon"] as const;
export type PenTip = (typeof penTips)[number];

// How a highlighter's or marker's line ends. Pen and neon always end round.
export const penEnds = ["square", "rounded", "round"] as const;
export type PenEnds = (typeof penEnds)[number];

/**
 * What a stroke draws with: a pen's color, or an eraser, which clears what
 * the drawing's earlier strokes drew. `width` is the line's thickness, glow
 * and all. A pen without a `tip` is a plain round one.
 * - `ends`: a highlighter's or marker's ends; absent is square, as strokes
 *   were saved before it existed.
 * - `opacity`: the ink's, 0–1; absent is the tip's own (`tipOpacity`). A
 *   highlighter ignores it, since its multiply blend already shows through.
 */
export type Brush =
	| {
			type: "pen";
			color: string;
			width: number;
			tip?: PenTip;
			ends?: PenEnds;
			opacity?: number;
	  }
	| { type: "eraser"; width: number };

export type PenBrush = Extract<Brush, { type: "pen" }>;

// `points` is flattened x, y pairs, which keeps saved projects small.
export type Stroke = Brush & { points: number[] };

// A neon stroke's blurred glow, as shares of its width: the glow's own width
// and its blur's sigma. `DrawingLayerView` draws it; erasing measures it.
export const NEON_GLOW = 0.55;
export const NEON_GLOW_BLUR = 0.16;

// A marker's ink is see-through, so what it marks shows through it. Saved
// strokes rely on it: one drawn at its tip's opacity saves none, as strokes
// were saved before opacity existed, so changing this restyles them all.
export const MARKER_OPACITY = 0.45;

/** The faintest ink a pen stroke draws, or its opacity slider reaches. */
export const MIN_OPACITY = 0.1;

/** The ink's opacity when a stroke doesn't save its own. */
export function tipOpacity(tip: PenTip | undefined): number {
	return tip === "ink" || tip === "marker" ? MARKER_OPACITY : 1;
}

/** Whether a tip takes an opacity of its own: all but the highlighter. */
export function hasOpacity(tip: PenTip | undefined): boolean {
	return tip !== "marker";
}

/** Whether a tip's ends can be chosen: the highlighter's and the marker's. */
export function hasEnds(tip: PenTip | undefined): boolean {
	return tip === "marker" || tip === "ink";
}

/** How a pen stroke's line ends. Any saved value it doesn't know is square. */
export function strokeEnds(brush: PenBrush): PenEnds {
	if (!hasEnds(brush.tip)) return "round";
	return brush.ends === "rounded" || brush.ends === "round"
		? brush.ends
		: "square";
}

/**
 * A pen stroke's ink opacity: its own, from `MIN_OPACITY` to 1, else its
 * tip's.
 * A highlighter's is always its tip's.
 */
export function strokeOpacity(brush: PenBrush): number {
	const { opacity } = brush;
	if (!hasOpacity(brush.tip) || typeof opacity !== "number") {
		return tipOpacity(brush.tip);
	}
	return Number.isFinite(opacity)
		? Math.min(1, Math.max(MIN_OPACITY, opacity))
		: tipOpacity(brush.tip);
}

/**
 * A pen brush with only what differs from the defaults saved: no `tip` for
 * the round pen, `ends` only where a tip has them and they aren't square,
 * and `opacity` only where a tip takes one and it isn't the tip's own.
 */
export function penBrush(style: {
	color: string;
	width: number;
	tip?: PenTip;
	ends?: PenEnds;
	opacity?: number;
}): PenBrush {
	const { color, width, tip, ends, opacity } = style;
	const brush: PenBrush = { type: "pen", color, width };
	if (tip !== undefined) brush.tip = tip;
	if (hasEnds(tip) && (ends === "rounded" || ends === "round")) {
		brush.ends = ends;
	}
	if (hasOpacity(tip) && opacity !== undefined && opacity !== tipOpacity(tip)) {
		brush.opacity = opacity;
	}
	return brush;
}

/** Whether two pen brushes look alike but for width. */
export function sameLook(a: PenBrush, b: PenBrush): boolean {
	return (
		a.tip === b.tip &&
		a.color.toLowerCase() === b.color.toLowerCase() &&
		strokeEnds(a) === strokeEnds(b) &&
		strokeOpacity(a) === strokeOpacity(b)
	);
}

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

// A rounded end's corners, as a share of the stroke's width: a quarter, as
// the size dot that previews it. Strokes save only that their ends are
// rounded, so changing this reshapes every one saved.
export const ROUNDED_END = 0.25;

/**
 * How far a pen stroke's ink reaches from its line: half its width for
 * round ends, to the corners of a marker's or highlighter's square or
 * rounded ends, and to where a neon glow's blur fades out (three sigmas).
 */
export function visibleReach(stroke: Brush): number {
	if (stroke.type !== "pen") return stroke.width / 2;
	if (stroke.tip === "neon") {
		return stroke.width * (NEON_GLOW / 2 + 3 * NEON_GLOW_BLUR);
	}
	const ends = strokeEnds(stroke);
	if (ends === "square") return stroke.width * Math.SQRT1_2;
	if (ends === "rounded") {
		// Skia's corner effect is a quadratic through the corner, not an arc:
		// its middle lies a quarter of the corner in from the square's.
		const corner = stroke.width * ROUNDED_END;
		return Math.SQRT2 * (stroke.width / 2 - corner / 4);
	}
	return stroke.width / 2;
}

/**
 * A mark's style: its last pen stroke's tip, color, width, ends, and
 * opacity, in the layer's own space. Null for a drawing with no pen strokes.
 */
export function markStyle(layer: DrawingLayer): PenBrush | null {
	for (let i = layer.strokes.length - 1; i >= 0; i--) {
		const stroke = layer.strokes[i];
		if (stroke.type === "pen") {
			const { color, width, tip } = stroke;
			return penBrush({
				color,
				width,
				tip,
				ends: strokeEnds(stroke),
				opacity: strokeOpacity(stroke),
			});
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

// Whether later erasers clear every bit of the pen `strokes[index]`'s ink:
// each sample along its line is within one eraser's reach less the ink's.
function erasedAway(strokes: Stroke[], index: number): boolean {
	const pen = strokes[index];
	const reach = visibleReach(pen);
	const penBox = lineBox(pen.points, reach);
	const erasers = strokes
		.slice(index + 1)
		.filter(
			(stroke) =>
				stroke.type === "eraser" &&
				stroke.width / 2 > reach &&
				boxesOverlap(penBox, lineBox(stroke.points, stroke.width / 2)),
		);
	if (erasers.length === 0) return false;
	// Erased away when no sample is left uncleared.
	return !segmentsNear(
		pen.points,
		identityTransform,
		pen.width / 4,
		(point) =>
			!erasers.some((eraser) =>
				nearLine(eraser.points, point, eraser.width / 2 - reach),
			),
	);
}

// Whether the eraser `strokes[index]` passes over any pen's ink before it.
function erasesAnything(strokes: Stroke[], index: number): boolean {
	const eraser = strokes[index];
	const half = eraser.width / 2;
	const eraserBox = lineBox(eraser.points, half);
	return strokes.slice(0, index).some((pen) => {
		if (pen.type !== "pen") return false;
		const reach = visibleReach(pen);
		if (!boxesOverlap(eraserBox, lineBox(pen.points, reach))) return false;
		// Half a step more, as the eraser is sampled at steps of `half`.
		return segmentsNear(eraser.points, identityTransform, half, (point) =>
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
