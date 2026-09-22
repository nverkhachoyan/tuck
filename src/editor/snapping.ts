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
