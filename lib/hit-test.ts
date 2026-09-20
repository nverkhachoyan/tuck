import type { Transform } from "./editor-document";

export type Point = { x: number; y: number };

/**
 * Maps a document-space point into a layer's local space, where the layer's
 * center is the origin and its rotation/scale are undone. Inverse of the
 * translate → rotate → scale order used to draw the layer.
 */
export function toLayerSpace(transform: Transform, point: Point): Point {
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
	const local = toLayerSpace(transform, point);
	return Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight;
}
