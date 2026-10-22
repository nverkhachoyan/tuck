// Relative `.ts` imports keep this loadable by Node's test runner.
import {
	isLineShape,
	type ShapeKind,
	type ShapePlacement,
} from "../../../model/document.ts";
import {
	type Point,
	rectFromCorners,
	type Transform,
	toDocumentSpace,
} from "../../../model/geometry.ts";
import { ROTATION_SNAP, snapAngle } from "./snapping.ts";

// Worklets, so a shape being dragged out, or a line's end being dragged,
// follows the finger on the UI thread.

/** A line's placement, and whether its angle snapped to a quarter turn. */
export type LinePlacement = ShapePlacement & { snapped: boolean };

/**
 * The line from `tail` to `head` as a shape places it: its middle, its
 * angle, and its length as its width. Near a quarter turn it settles on
 * one, turning about `pivot`, which stays put. It's at least `minLength`
 * long, running on from `pivot` the way it points.
 */
export function lineBetween(
	tail: Point,
	head: Point,
	pivot: "tail" | "head",
	minLength = 0,
): LinePlacement {
	"worklet";
	const dx = head.x - tail.x;
	const dy = head.y - tail.y;
	const angle = Math.atan2(dy, dx);
	const snapped = snapAngle(angle, Math.PI / 2, ROTATION_SNAP);
	const rotation = snapped ?? angle;
	const length = Math.max(Math.hypot(dx, dy), minLength);
	const halfX = (Math.cos(rotation) * length) / 2;
	const halfY = (Math.sin(rotation) * length) / 2;
	const [x, y] =
		pivot === "tail"
			? [tail.x + halfX, tail.y + halfY]
			: [head.x - halfX, head.y - halfY];
	return {
		x,
		y,
		rotation,
		width: length,
		height: 0,
		snapped: snapped !== null,
	};
}

/**
 * The shape dragged from `start` to `end`: a box with them at opposite
 * corners, or a line from one to the other, pointing to `end`.
 */
export function shapeFromDrag(
	shape: ShapeKind,
	start: Point,
	end: Point,
): ShapePlacement {
	"worklet";
	if (isLineShape(shape)) return lineBetween(start, end, "tail");
	const rect = rectFromCorners(start, end);
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2,
		rotation: 0,
		width: rect.width,
		height: rect.height,
	};
}

/**
 * A line `halfLength` either way from where `transform` places it, after
 * its tail (`side` -1) or its head (`side` 1) is dragged by `offset` in
 * document space. The other end stays put. The placement's width is in
 * document units: a scaled layer's own length is that over its scale.
 */
export function dragLineEnd(
	transform: Transform,
	halfLength: number,
	side: -1 | 1,
	offset: Point,
	minLength: number,
): LinePlacement {
	"worklet";
	const tail = toDocumentSpace(transform, { x: -halfLength, y: 0 });
	const head = toDocumentSpace(transform, { x: halfLength, y: 0 });
	return side === 1
		? lineBetween(
				tail,
				{ x: head.x + offset.x, y: head.y + offset.y },
				"tail",
				minLength,
			)
		: lineBetween(
				{ x: tail.x + offset.x, y: tail.y + offset.y },
				head,
				"head",
				minLength,
			);
}
