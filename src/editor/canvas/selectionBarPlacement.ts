import {
	type Box,
	type Point,
	type Rect,
	type Size,
	type Transform,
	toDocumentSpace,
} from "../document/geometry.ts";
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

/** How much of `a` lies under `b`, in square points. */
function overlapArea(a: Rect, b: Rect): number {
	"worklet";
	const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Where the bar's top-left corner goes, kept `margin` inside `area`:
 * - centered over the selection horizontally;
 * - of the spots that fit, the one covering least of `photo` (the document
 *   on screen): `above` clear of the selection's top (past the rotate knob),
 *   `below` clear of its bottom, or out on the table just past the photo's
 *   top or bottom edge, when that's near;
 * - on a tie, above, then below, then the nearer of the table's spots;
 * - with room nowhere, as for a layer filling the view, it keeps to the top,
 *   and past the view's edge, to that edge.
 */
export function placeSelectionBar(
	selection: Rect,
	bar: Size,
	area: Size,
	gaps: { above: number; below: number; margin: number },
	photo: Rect,
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
	const fits = (y: number) => y >= margin && y <= lowest;
	// A table spot counts only past the selection's own spot on that side,
	// while that spot fits, and within two bar heights of it: the bar never
	// lands on the selection, jumps across the photo from one dragged out of
	// view, or strays far enough to seem another layer's. The nearer table
	// spot wins a tie.
	const overPhoto = photo.y - below - bar.height;
	const underPhoto = photo.y + photo.height + below;
	const candidates = [
		{ y: aboveY, away: 0 },
		{ y: belowY, away: 0 },
		{ y: overPhoto, away: fits(aboveY) ? aboveY - overPhoto : -1 },
		{ y: underPhoto, away: fits(belowY) ? underPhoto - belowY : -1 },
	];
	let best = -1;
	let bestCovered = 0;
	let bestAway = 0;
	for (let index = 0; index < candidates.length; index++) {
		const { y, away } = candidates[index];
		if (!fits(y) || away < 0 || away > bar.height * 2) continue;
		const covered = overlapArea(
			{ x, y, width: bar.width, height: bar.height },
			photo,
		);
		// Within a square point counts as the same, so rounding never flips it.
		const better =
			best === -1 ||
			covered < bestCovered - 1 ||
			(covered <= bestCovered + 1 && away < bestAway);
		if (better) {
			best = index;
			bestCovered = covered;
			bestAway = away;
		}
	}
	if (best !== -1) return { x, y: candidates[best].y };
	// A selection dragged past the view's edge keeps the bar inside it.
	const y = clamp(
		aboveY < margin && belowY <= lowest ? belowY : aboveY,
		margin,
		lowest,
	);
	return { x, y };
}
