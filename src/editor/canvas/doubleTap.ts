import type { Point } from "../../model/geometry.ts";

// A second tap this soon after the first, and this near it in screen
// pixels, makes a double tap.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 12;

const NO_TAP = { time: 0, x: 0, y: 0 };

/**
 * Tells the second of two taps from a first. `tap` says whether a tap at
 * `point` is a second; a first counts toward the next, and a second starts
 * over. `reset` forgets the last tap, for a tap that shouldn't count.
 */
export function createDoubleTap() {
	let last = NO_TAP;
	return {
		tap(point: Point, now = Date.now()): boolean {
			const double =
				now - last.time < DOUBLE_TAP_MS &&
				Math.hypot(point.x - last.x, point.y - last.y) < DOUBLE_TAP_SLOP_PX;
			last = double ? NO_TAP : { time: now, ...point };
			return double;
		},
		reset() {
			last = NO_TAP;
		},
	};
}
