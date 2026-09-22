export type Point = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

/** A box centered on its layer's origin, in the layer's local units. */
export type Box = {
	halfWidth: number;
	halfHeight: number;
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

/** Whether a document-space point lands inside a layer's local-space box. */
export function hitTestBox(
	transform: Transform,
	box: Box,
	point: Point,
): boolean {
	"worklet";
	const local = toLayerSpace(transform, point);
	return (
		Math.abs(local.x) <= box.halfWidth && Math.abs(local.y) <= box.halfHeight
	);
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

export function transformsEqual(left: Transform, right: Transform): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.scaleX === right.scaleX &&
		left.scaleY === right.scaleY &&
		left.rotation === right.rotation
	);
}
