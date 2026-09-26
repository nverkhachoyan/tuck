// Relative `.ts` import keeps this loadable by Node's test runner.
import {
	type Box,
	type Point,
	type Transform,
	toDocumentSpace,
} from "../../../model/geometry.ts";

// The selection's corner (scale) and knob (rotate) handles, the side handles
// of a box that resizes freely, and the drags that grab them. Worklets, like `model/geometry.ts`, so gestures run them on
// the UI thread. Sizes come in as arguments: `handleMetrics.ts` picks them
// for the platform, which keeps this file free of React Native and testable.

export type Corner = "top-left" | "top-right" | "bottom-right" | "bottom-left";
export type Side = "top" | "right" | "bottom" | "left";
export type Handle = Corner | Side | "rotate";
/** A handle that resizes a box that resizes freely. */
export type ResizeHandle = Corner | Side;

/**
 * How a layer's handles change its box, if they do, rather than scale it:
 * `box` resizes its sides each on its own (a redaction's box, or a shape's),
 * `stretch` does too but by stretching its scale (an image or text set to),
 * and `endpoints` drags either end of a line anywhere, turning it too.
 */
export type ResizeMode = "none" | "box" | "stretch" | "endpoints";

/**
 * Where each handle sits on its box, along each of the layer's axes: -1 on
 * its left or top side, 1 on its right or bottom, 0 halfway between.
 */
const HANDLE_SIDES: Record<ResizeHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
	"top-left": { x: -1, y: -1 },
	top: { x: 0, y: -1 },
	"top-right": { x: 1, y: -1 },
	right: { x: 1, y: 0 },
	"bottom-right": { x: 1, y: 1 },
	bottom: { x: 0, y: 1 },
	"bottom-left": { x: -1, y: 1 },
	left: { x: -1, y: 0 },
};

export const CORNERS: readonly Corner[] = [
	"top-left",
	"top-right",
	"bottom-right",
	"bottom-left",
];

/** The sides of its box a handle moves (see `HANDLE_SIDES`). */
export function handleSides(handle: ResizeHandle): {
	x: -1 | 0 | 1;
	y: -1 | 0 | 1;
} {
	"worklet";
	return HANDLE_SIDES[handle];
}

/**
 * Document-space center of one of a box's handles. The knob sits
 * `knobOffset` document units above the middle of the top edge, however the
 * layer is scaled, so it stays the same distance away on screen.
 */
export function handlePosition(
	transform: Transform,
	box: Box,
	handle: Handle,
	knobOffset: number,
): Point {
	"worklet";
	const { halfWidth: w, halfHeight: h } = box;
	if (handle === "rotate") {
		const top = toDocumentSpace(transform, { x: 0, y: -h });
		// The layer's "up", rotated with it.
		const upX = Math.sin(transform.rotation);
		const upY = -Math.cos(transform.rotation);
		return { x: top.x + upX * knobOffset, y: top.y + upY * knobOffset };
	}
	const sides = HANDLE_SIDES[handle];
	return toDocumentSpace(transform, { x: sides.x * w, y: sides.y * h });
}

/**
 * Which of `handles` is within `radius` document units of a document-space
 * point, or null. When handles overlap (a tiny box), the nearest one wins.
 */
export function handleAt(
	transform: Transform,
	box: Box,
	point: Point,
	radius: number,
	knobOffset: number,
	handles: readonly Handle[],
): Handle | null {
	"worklet";
	let nearest: Handle | null = null;
	let nearestDistance = radius;
	for (const handle of handles) {
		const position = handlePosition(transform, box, handle, knobOffset);
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

// `resizeByDrag` along one of the layer's axes: the box's new half length,
// and how far its center moves in the layer's space.
function resizeAxis(
	half: number,
	side: -1 | 0 | 1,
	offset: number,
	minSize: number,
): { half: number; center: number } {
	"worklet";
	if (side === 0) return { half, center: 0 };
	const length = Math.max(
		Math.min(minSize, half * 2),
		half * 2 + side * offset,
	);
	return { half: length / 2, center: side * (length / 2 - half) };
}

/**
 * A box that resizes freely, after dragging one of its handles by `offset`
 * in its layer's own units (see `toLayerSpace`): a side handle moves that
 * side, and a corner the two sides that meet there. The opposite sides stay
 * put, so the box's center moves with its size, and its transform with it.
 * Its sides stay at least `minSize` apart, or as close as they started if
 * nearer, so the box can't collapse or turn inside out.
 */
export function resizeByDrag(
	transform: Transform,
	box: Box,
	handle: ResizeHandle,
	offset: Point,
	minSize: number,
): { transform: Transform; box: Box } {
	"worklet";
	const sides = HANDLE_SIDES[handle];
	const x = resizeAxis(box.halfWidth, sides.x, offset.x, minSize);
	const y = resizeAxis(box.halfHeight, sides.y, offset.y, minSize);
	const center = toDocumentSpace(transform, { x: x.center, y: y.center });
	return {
		transform: { ...transform, x: center.x, y: center.y },
		box: { halfWidth: x.half, halfHeight: y.half },
	};
}

/**
 * Like `resizeByDrag`, but keeps the box's starting proportions. The dragged
 * side keeps its opposite side fixed; an untouched axis grows about center.
 */
export function resizeLockedByDrag(
	transform: Transform,
	box: Box,
	handle: ResizeHandle,
	offset: Point,
	minSize: number,
): { transform: Transform; box: Box } {
	"worklet";
	const raw = resizeByDrag(transform, box, handle, offset, minSize);
	const sides = HANDLE_SIDES[handle];
	const scale =
		sides.x === 0
			? raw.box.halfHeight / box.halfHeight
			: sides.y === 0
				? raw.box.halfWidth / box.halfWidth
				: Math.abs(raw.box.halfWidth / box.halfWidth - 1) >=
						Math.abs(raw.box.halfHeight / box.halfHeight - 1)
					? raw.box.halfWidth / box.halfWidth
					: raw.box.halfHeight / box.halfHeight;
	const next = {
		halfWidth: box.halfWidth * scale,
		halfHeight: box.halfHeight * scale,
	};
	const center = toDocumentSpace(transform, {
		x: sides.x === 0 ? 0 : sides.x * (next.halfWidth - box.halfWidth),
		y: sides.y === 0 ? 0 : sides.y * (next.halfHeight - box.halfHeight),
	});
	return { transform: { ...transform, x: center.x, y: center.y }, box: next };
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
