// Relative `.ts` import keeps this loadable by Node's test runner.
import {
	type Box,
	boundingBox,
	cosSin,
	type Size,
	type Transform,
} from "../../../model/geometry.ts";

// Worklets, like `model/geometry.ts`, so gestures run them on the UI thread.

/** How near a quarter turn a layer's or a line's angle settles on it. */
export const ROTATION_SNAP = (4 * Math.PI) / 180;

/** `target` when `value` is within `tolerance` of it, otherwise null. */
export function snapTo(
	value: number,
	target: number,
	tolerance: number,
): number | null {
	"worklet";
	return Math.abs(value - target) <= tolerance ? target : null;
}

/**
 * Snaps a span along one axis, given by its center and half its length:
 * either end onto one of `edges`, or its center onto one of `centers`,
 * whichever is closest within `tolerance`. Returns the span's new center and
 * the line it snapped to, or null when no line is in reach. On a tie the
 * center wins, so a span as long as the canvas shows the center line.
 */
export function snapSpan(
	center: number,
	halfLength: number,
	edges: readonly number[],
	centers: readonly number[],
	tolerance: number,
): { center: number; line: number } | null {
	"worklet";
	let snap: { center: number; line: number } | null = null;
	let closest = Number.POSITIVE_INFINITY;
	for (const line of centers) {
		const distance = Math.abs(line - center);
		if (distance <= tolerance && distance < closest) {
			snap = { center: line, line };
			closest = distance;
		}
	}
	for (const line of edges) {
		for (const side of [-1, 1]) {
			const distance = Math.abs(line - (center + side * halfLength));
			if (distance <= tolerance && distance < closest) {
				snap = { center: line - side * halfLength, line };
				closest = distance;
			}
		}
	}
	return snap;
}

/**
 * The multiple of `step` within `tolerance` of `angle` (all in radians), or
 * null, so upright is easy to hit exactly.
 */
export function snapAngle(
	angle: number,
	step: number,
	tolerance: number,
): number | null {
	"worklet";
	return snapTo(angle, Math.round(angle / step) * step, tolerance);
}

/** The lines along one axis that a layer's edges, or its center, snap onto. */
export type AxisLines = { edges: number[]; centers: number[] };

// The line in `lines` nearest to `value` within `tolerance`, or null.
function nearestLine(
	value: number,
	lines: AxisLines,
	tolerance: number,
): number | null {
	"worklet";
	let nearest: number | null = null;
	let closest = tolerance;
	for (const group of [lines.edges, lines.centers]) {
		for (const line of group) {
			const distance = Math.abs(line - value);
			if (distance <= closest) {
				nearest = line;
				closest = distance;
			}
		}
	}
	return nearest;
}

/**
 * Snaps a side of a layer's box that's being dragged onto any of `lines`,
 * edge or center. The side sits at `position` along the layer's own `axis`,
 * in its units. Returns where the side lands, in the same terms, and the
 * document's line it snapped to: a vertical line at x = `line` when `guide`
 * is "x", a horizontal one when it's "y". Null when no line is in reach, or
 * when the layer is turned off a quarter turn, which leaves its sides
 * slanted across the lines.
 */
export function snapSide(
	transform: Transform,
	axis: "x" | "y",
	position: number,
	lines: { x: AxisLines; y: AxisLines },
	tolerance: number,
): { position: number; guide: "x" | "y"; line: number } | null {
	"worklet";
	const { cos, sin } = cosSin(transform.rotation);
	// One unit along the layer's axis, in document space.
	const stepX = axis === "x" ? cos * transform.scaleX : -sin * transform.scaleY;
	const stepY = axis === "x" ? sin * transform.scaleX : cos * transform.scaleY;
	let guide: "x" | "y";
	let step: number;
	let start: number;
	if (stepY === 0) {
		guide = "x";
		step = stepX;
		start = transform.x;
	} else if (stepX === 0) {
		guide = "y";
		step = stepY;
		start = transform.y;
	} else {
		return null;
	}
	const at = start + position * step;
	const line = nearestLine(at, lines[guide], tolerance);
	if (line === null) return null;
	return { position: position + (line - at) / step, guide, line };
}

/**
 * Along one axis of a canvas `length` long: its edges and center, then the
 * ends and middle of each span. Lines off the canvas are left out, since
 * nothing past its edges is exported.
 */
function axisLines(
	length: number,
	spans: readonly { start: number; end: number }[],
): AxisLines {
	"worklet";
	const edges = [0, length];
	const centers = [length / 2];
	for (const { start, end } of spans) {
		if (start >= 0 && start <= length) edges.push(start);
		if (end >= 0 && end <= length) edges.push(end);
		const center = (start + end) / 2;
		if (center >= 0 && center <= length) centers.push(center);
	}
	return { edges, centers };
}

/**
 * The lines a dragged layer snaps onto over a canvas of `size`: the canvas's
 * edges and center, and those of the upright box around each of `others`.
 * A `clipped` layer is cut off at the canvas's edge, so it counts only as
 * far as the canvas shows it.
 */
export function snapLinesFor(
	size: Size,
	others: readonly { transform: Transform; box: Box; clipped: boolean }[],
): { x: AxisLines; y: AxisLines } {
	"worklet";
	const spansX: { start: number; end: number }[] = [];
	const spansY: { start: number; end: number }[] = [];
	for (const { transform, box, clipped } of others) {
		const { halfWidth, halfHeight } = boundingBox(transform, box);
		let left = transform.x - halfWidth;
		let right = transform.x + halfWidth;
		let top = transform.y - halfHeight;
		let bottom = transform.y + halfHeight;
		if (clipped) {
			left = Math.max(0, left);
			right = Math.min(size.width, right);
			top = Math.max(0, top);
			bottom = Math.min(size.height, bottom);
			// Entirely off the canvas: nothing of it shows.
			if (left > right || top > bottom) continue;
		}
		spansX.push({ start: left, end: right });
		spansY.push({ start: top, end: bottom });
	}
	return {
		x: axisLines(size.width, spansX),
		y: axisLines(size.height, spansY),
	};
}
