export type Point = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

export type Transform = {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
};

// Functions here are marked "worklet" so gestures can call them on the UI
// thread too. The directive is only a string: this stays plain TypeScript.

/**
 * Maps a document-space point into a layer's local space, where the layer's
 * center is the origin and its rotation/scale are undone. Inverse of the
 * translate → rotate → scale order used to draw the layer.
 */
export function toLayerSpace(transform: Transform, point: Point): Point {
	"worklet";
	const dx = point.x - transform.x;
	const dy = point.y - transform.y;
	const cos = Math.cos(-transform.rotation);
	const sin = Math.sin(-transform.rotation);
	return {
		x: (dx * cos - dy * sin) / transform.scaleX,
		y: (dx * sin + dy * cos) / transform.scaleY,
	};
}

/**
 * Whether a document-space point lands inside a layer's local-space box
 * (centered on the origin, `halfWidth` × `halfHeight` in each direction).
 */
export function hitTestBox(
	transform: Transform,
	halfWidth: number,
	halfHeight: number,
	point: Point,
): boolean {
	"worklet";
	const local = toLayerSpace(transform, point);
	return Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight;
}

/** The inverse of `toLayerSpace`: a layer-local point in document space. */
export function toDocumentSpace(transform: Transform, point: Point): Point {
	"worklet";
	const x = point.x * transform.scaleX;
	const y = point.y * transform.scaleY;
	const cos = Math.cos(transform.rotation);
	const sin = Math.sin(transform.rotation);
	return {
		x: transform.x + x * cos - y * sin,
		y: transform.y + x * sin + y * cos,
	};
}

/** A box centered on its layer's origin, in the layer's local units. */
export type Box = {
	halfWidth: number;
	halfHeight: number;
};

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

/**
 * Pulls an angle onto the nearest multiple of `step` when it's within
 * `tolerance` of it (all in radians), so upright is easy to hit exactly.
 */
export function snapAngle(
	angle: number,
	step: number,
	tolerance: number,
): number {
	"worklet";
	const snapped = Math.round(angle / step) * step;
	return Math.abs(angle - snapped) <= tolerance ? snapped : angle;
}
