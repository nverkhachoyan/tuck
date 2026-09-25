// Relative `.ts` import keeps this loadable by Node's test runner.
import {
	type Box,
	type Point,
	type Transform,
	toDocumentSpace,
} from "../../../model/geometry.ts";

// The selection's corner (scale) and knob (rotate) handles, and the drags
// that grab them. Worklets, like `model/geometry.ts`, so gestures run them on
// the UI thread. Sizes come in as arguments: `handleMetrics.ts` picks them
// for the platform, which keeps this file free of React Native and testable.

export type Handle =
	| "top-left"
	| "top-right"
	| "bottom-right"
	| "bottom-left"
	| "rotate";

/**
 * Document-space centers of a box's corner handles and its rotate knob. The
 * knob sits `knobOffset` document units above the middle of the top edge,
 * however the layer is scaled, so it stays the same distance away on screen.
 */
export function handlePositions(
	transform: Transform,
	box: Box,
	knobOffset: number,
): Record<Handle, Point> {
	"worklet";
	const { halfWidth: w, halfHeight: h } = box;
	const top = toDocumentSpace(transform, { x: 0, y: -h });
	// The layer's "up", rotated with it.
	const upX = Math.sin(transform.rotation);
	const upY = -Math.cos(transform.rotation);
	return {
		"top-left": toDocumentSpace(transform, { x: -w, y: -h }),
		"top-right": toDocumentSpace(transform, { x: w, y: -h }),
		"bottom-right": toDocumentSpace(transform, { x: w, y: h }),
		"bottom-left": toDocumentSpace(transform, { x: -w, y: h }),
		rotate: { x: top.x + upX * knobOffset, y: top.y + upY * knobOffset },
	};
}

const HANDLES: Handle[] = [
	"top-left",
	"top-right",
	"bottom-right",
	"bottom-left",
	"rotate",
];

/**
 * The handle within `radius` document units of a document-space point, or
 * null. When handles overlap (a tiny box), the nearest one wins.
 */
export function handleAt(
	transform: Transform,
	box: Box,
	point: Point,
	radius: number,
	knobOffset: number,
): Handle | null {
	"worklet";
	const positions = handlePositions(transform, box, knobOffset);
	let nearest: Handle | null = null;
	let nearestDistance = radius;
	for (const handle of HANDLES) {
		const position = positions[handle];
		const distance = Math.hypot(point.x - position.x, point.y - position.y);
		if (distance <= nearestDistance) {
			nearest = handle;
			nearestDistance = distance;
		}
	}
	return nearest;
}

/**
 * The scale after dragging a corner from `from` to `to`: it grows with the
 * pointer's distance from the center, so the grabbed corner follows it.
 */
export function scaleByDrag(
	center: Point,
	from: Point,
	to: Point,
	startScale: number,
): number {
	"worklet";
	const startDistance = Math.hypot(from.x - center.x, from.y - center.y);
	if (startDistance === 0) return startScale;
	const distance = Math.hypot(to.x - center.x, to.y - center.y);
	return startScale * (distance / startDistance);
}

/** The rotation after dragging from `from` to `to` around `center`. */
export function rotateByDrag(
	center: Point,
	from: Point,
	to: Point,
	startRotation: number,
): number {
	"worklet";
	const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
	const angle = Math.atan2(to.y - center.y, to.x - center.x);
	return startRotation + angle - startAngle;
}
