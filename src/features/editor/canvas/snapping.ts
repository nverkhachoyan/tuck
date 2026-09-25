// Relative `.ts` import keeps this loadable by Node's test runner.
import {
	type Box,
	boundingBox,
	type Size,
	type Transform,
} from "../../../model/geometry.ts";

// Worklets, like `model/geometry.ts`, so gestures run them on the UI thread.

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
