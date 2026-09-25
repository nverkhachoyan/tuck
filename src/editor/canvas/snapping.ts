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
