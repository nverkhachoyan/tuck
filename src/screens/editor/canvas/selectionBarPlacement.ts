// Relative `.ts` imports keep this loadable by Node's test runner.
import {
	type Box,
	type Point,
	type Rect,
	type Size,
	type Transform,
	toDocumentSpace,
} from "../../../model/geometry.ts";
import type { DocumentViewport } from "./viewport.ts";

// Worklets, so the selection bar follows its layer on the UI thread.

/** The on-screen rectangle around a layer's box, however it's rotated. */
export function selectionScreenBounds(
	transform: Transform,
	box: Box,
	viewport: DocumentViewport,
): Rect {
	"worklet";
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	for (const [sx, sy] of [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	]) {
		const corner = toDocumentSpace(transform, {
			x: sx * box.halfWidth,
			y: sy * box.halfHeight,
		});
		const x = viewport.offsetX + corner.x * viewport.scale;
		const y = viewport.offsetY + corner.y * viewport.scale;
		left = Math.min(left, x);
		top = Math.min(top, y);
		right = Math.max(right, x);
		bottom = Math.max(bottom, y);
	}
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Where the bar's top-left corner goes: centered over the selection,
 * `above` clear of its top (past the rotate knob), or `below` clear of its
 * bottom when there's no room above, and kept `margin` inside `area`. With
 * room on neither side, as for a layer filling the view, it keeps to the top,
 * and past the view's edge, to that edge.
 */
export function placeSelectionBar(
	selection: Rect,
	bar: Size,
	area: Size,
	gaps: { above: number; below: number; margin: number },
): Point {
	"worklet";
	const { above, below, margin } = gaps;
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(value, max));
	const x = clamp(
		selection.x + selection.width / 2 - bar.width / 2,
		margin,
		area.width - margin - bar.width,
	);
	const aboveY = selection.y - above - bar.height;
	const belowY = selection.y + selection.height + below;
	const lowest = area.height - margin - bar.height;
	// A selection dragged past the view's edge keeps the bar inside it.
	const y = clamp(
		aboveY < margin && belowY <= lowest ? belowY : aboveY,
		margin,
		lowest,
	);
	return { x, y };
}
