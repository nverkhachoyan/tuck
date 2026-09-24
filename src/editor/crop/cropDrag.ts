// Relative `.ts` imports keep this loadable by Node's test runner.
import type { Point, Rect, Size } from "../../model/geometry.ts";
import { photoCorners } from "./cropGeometry.ts";

// Dragging the crop box's handles, in crop space (see `cropGeometry.ts`).

// A canvas's side can grow to this many times the photo's longer side.
const MAX_CANVAS_FACTOR = 2;

export type CropHandle =
	| "top-left"
	| "top"
	| "top-right"
	| "right"
	| "bottom-right"
	| "bottom"
	| "bottom-left"
	| "left"
	| "move";

type Edge = "left" | "top" | "right" | "bottom";

/** Which edges and center lines a drag landed on, as `SNAP` bits. */
export const SNAP = {
	left: 1,
	top: 2,
	right: 4,
	bottom: 8,
	centerX: 16,
	centerY: 32,
} as const;

/**
 * How far the photo reaches along one axis, on a line across the other:
 * along x at height `at` for "x", along y at `at` across for "y". A line past
 * the photo is moved onto its nearest edge first.
 */
function photoSpan(
	corners: Point[],
	axis: "x" | "y",
	at: number,
): { min: number; max: number } {
	"worklet";
	const across = axis === "x" ? "y" : "x";
	let low = Number.POSITIVE_INFINITY;
	let high = Number.NEGATIVE_INFINITY;
	for (const corner of corners) {
		low = Math.min(low, corner[across]);
		high = Math.max(high, corner[across]);
	}
	const line = Math.min(high, Math.max(low, at));
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < corners.length; i++) {
		const p = corners[i];
		const q = corners[(i + 1) % corners.length];
		if (p[across] === q[across]) continue;
		if ((p[across] - line) * (q[across] - line) > 0) continue;
		const t = (line - p[across]) / (q[across] - p[across]);
		const value = p[axis] + t * (q[axis] - p[axis]);
		min = Math.min(min, value);
		max = Math.max(max, value);
	}
	return { min, max };
}

/**
 * Where an edge would sit to just reach the photo's edge, given where the
 * box's other edges are: a straight photo's own edge, or for a straightened
 * one the farthest the edge can go with both its corners on the photo.
 */
function edgeTarget(edge: Edge, box: Rect, corners: Point[]): number {
	"worklet";
	if (edge === "left" || edge === "right") {
		const top = photoSpan(corners, "x", box.y);
		const bottom = photoSpan(corners, "x", box.y + box.height);
		return edge === "left"
			? Math.max(top.min, bottom.min)
			: Math.min(top.max, bottom.max);
	}
	const left = photoSpan(corners, "y", box.x);
	const right = photoSpan(corners, "y", box.x + box.width);
	return edge === "top"
		? Math.max(left.min, right.min)
		: Math.min(left.max, right.max);
}

export type CropDragLimits = {
	photo: Size;
	angle: number;
	// Width / height to keep, or null to resize freely.
	ratio: number | null;
	// The smallest side, and where the box has to stay (what's on screen).
	minSize: number;
	bounds: Rect;
	// How close an edge must come to snap onto the photo's edge.
	tolerance: number;
};

const clamp = (value: number, low: number, high: number) => {
	"worklet";
	return Math.min(Math.max(value, low), Math.max(low, high));
};

/**
 * Moving the whole box: each axis snaps to whichever of its edges or its
 * center (onto the photo's) is nearest, and the box stays in bounds.
 */
function moveBox(
	start: Rect,
	dx: number,
	dy: number,
	corners: Point[],
	limits: CropDragLimits,
): { box: Rect; snapped: number } {
	"worklet";
	const { bounds, tolerance } = limits;
	let box = {
		...start,
		x: clamp(start.x + dx, bounds.x, bounds.x + bounds.width - start.width),
		y: clamp(start.y + dy, bounds.y, bounds.y + bounds.height - start.height),
	};
	let snapped = 0;

	const snapAxis = (horizontal: boolean) => {
		const position = horizontal ? box.x : box.y;
		const size = horizontal ? box.width : box.height;
		const candidates: [number, number][] = horizontal
			? [
					[edgeTarget("left", box, corners), SNAP.left],
					[edgeTarget("right", box, corners) - size, SNAP.right],
					[-size / 2, SNAP.centerX],
				]
			: [
					[edgeTarget("top", box, corners), SNAP.top],
					[edgeTarget("bottom", box, corners) - size, SNAP.bottom],
					[-size / 2, SNAP.centerY],
				];
		let best: [number, number] | null = null;
		for (const candidate of candidates) {
			const distance = Math.abs(candidate[0] - position);
			if (
				distance <= tolerance &&
				(!best || distance < Math.abs(best[0] - position))
			) {
				best = candidate;
			}
		}
		if (!best) return;
		snapped |= best[1];
		box = horizontal ? { ...box, x: best[0] } : { ...box, y: best[0] };
	};
	snapAxis(true);
	snapAxis(false);
	return { box, snapped };
}

/**
 * Resizing with the ratio kept. A corner scales the box from the opposite
 * corner, following the pointer along the box's diagonal; an edge moves out
 * and grows the other way evenly about the box's middle.
 */
function resizeLocked(
	start: Rect,
	handle: CropHandle,
	dx: number,
	dy: number,
	corners: Point[],
	maxSide: number,
	limits: CropDragLimits,
): { box: Rect; snapped: number } {
	"worklet";
	const { minSize, bounds, tolerance } = limits;
	const horizontal = handle.includes("left")
		? -1
		: handle.includes("right")
			? 1
			: 0;
	const vertical = handle.includes("top")
		? -1
		: handle.includes("bottom")
			? 1
			: 0;
	const { width, height } = start;
	const right = start.x + width;
	const bottom = start.y + height;
	const middleX = start.x + width / 2;
	const middleY = start.y + height / 2;

	// The box's scale, and the box it gives.
	const boxAt = (scale: number): Rect => {
		const w = width * scale;
		const h = height * scale;
		return {
			x:
				horizontal > 0 ? start.x : horizontal < 0 ? right - w : middleX - w / 2,
			y: vertical > 0 ? start.y : vertical < 0 ? bottom - h : middleY - h / 2,
			width: w,
			height: h,
		};
	};

	let scale: number;
	if (horizontal !== 0 && vertical !== 0) {
		const px = width + horizontal * dx;
		const py = height + vertical * dy;
		scale = (px * width + py * height) / (width * width + height * height);
	} else if (horizontal !== 0) {
		scale = (width + horizontal * dx) / width;
	} else {
		scale = (height + vertical * dy) / height;
	}

	// However far the box may grow from its fixed corner, edge, or middle.
	const room = (
		fixed: number,
		direction: number,
		low: number,
		high: number,
	) => {
		if (direction > 0) return high - fixed;
		if (direction < 0) return fixed - low;
		return 2 * Math.min(fixed - low, high - fixed);
	};
	const fixedX = horizontal > 0 ? start.x : horizontal < 0 ? right : middleX;
	const fixedY = vertical > 0 ? start.y : vertical < 0 ? bottom : middleY;
	const maxScale = Math.min(
		maxSide / Math.max(width, height),
		room(fixedX, horizontal, bounds.x, bounds.x + bounds.width) / width,
		room(fixedY, vertical, bounds.y, bounds.y + bounds.height) / height,
	);
	const minScale = minSize / Math.min(width, height);
	scale = clamp(scale, minScale, maxScale);

	// Snap whichever moving edge is nearest its target.
	let snapped = 0;
	let nearest = tolerance;
	const box = boxAt(scale);
	const tryEdge = (edge: Edge, targetScale: number) => {
		const distance =
			Math.abs(targetScale - scale) *
			(edge === "left" || edge === "right" ? width : height);
		const inRange = targetScale >= minScale && targetScale <= maxScale;
		if (inRange && distance <= nearest) {
			nearest = distance;
			snapped = SNAP[edge];
			scale = targetScale;
		}
	};
	if (horizontal !== 0) {
		const edge = horizontal > 0 ? "right" : "left";
		const target = edgeTarget(edge, box, corners);
		tryEdge(edge, (horizontal * (target - fixedX)) / width);
	}
	if (vertical !== 0) {
		const edge = vertical > 0 ? "bottom" : "top";
		const target = edgeTarget(edge, box, corners);
		tryEdge(edge, (vertical * (target - fixedY)) / height);
	}
	return { box: boxAt(scale), snapped };
}

/**
 * The box after dragging `handle` by (dx, dy) from `start`, in crop space.
 * Edges snap onto the photo's edges, so a crop meets them exactly and
 * dragging past them on purpose expands the canvas; `snapped` says which did.
 */
export function dragCrop(
	start: Rect,
	handle: CropHandle,
	dx: number,
	dy: number,
	limits: CropDragLimits,
): { box: Rect; snapped: number } {
	"worklet";
	const corners = photoCorners(limits.photo, limits.angle);
	const maxSide =
		MAX_CANVAS_FACTOR * Math.max(limits.photo.width, limits.photo.height);
	if (handle === "move") return moveBox(start, dx, dy, corners, limits);
	if (limits.ratio !== null) {
		return resizeLocked(start, handle, dx, dy, corners, maxSide, limits);
	}

	const { minSize, bounds, tolerance } = limits;
	let box = { ...start };
	let snapped = 0;
	const moves = (edge: Edge) => handle.includes(edge);

	// Moves one edge within its range, snapping onto its target.
	const moveEdge = (edge: Edge, raw: number, low: number, high: number) => {
		const value = clamp(raw, low, high);
		const target = edgeTarget(edge, box, corners);
		const inRange = target >= low && target <= Math.max(low, high);
		if (inRange && Math.abs(value - target) <= tolerance) {
			snapped |= SNAP[edge];
			return target;
		}
		return value;
	};

	// Across first, then up and down, so a straightened photo's vertical
	// target sees the new width.
	const right = box.x + box.width;
	if (moves("left")) {
		const left = moveEdge(
			"left",
			box.x + dx,
			Math.max(bounds.x, right - maxSide),
			right - minSize,
		);
		box = { ...box, x: left, width: right - left };
	} else if (moves("right")) {
		const value = moveEdge(
			"right",
			right + dx,
			box.x + minSize,
			Math.min(bounds.x + bounds.width, box.x + maxSide),
		);
		box = { ...box, width: value - box.x };
	}
	const bottom = box.y + box.height;
	if (moves("top")) {
		const top = moveEdge(
			"top",
			box.y + dy,
			Math.max(bounds.y, bottom - maxSide),
			bottom - minSize,
		);
		box = { ...box, y: top, height: bottom - top };
	} else if (moves("bottom")) {
		const value = moveEdge(
			"bottom",
			bottom + dy,
			box.y + minSize,
			Math.min(bounds.y + bounds.height, box.y + maxSide),
		);
		box = { ...box, height: value - box.y };
	}
	return { box, snapped };
}

/**
 * The handle at a point on screen, given the box's on-screen edges. Handles
 * reach `radius` outside the box but less inside, so a small box can still
 * be moved by its middle.
 */
export function cropHandleAt(
	edges: { left: number; top: number; right: number; bottom: number },
	point: Point,
	radius: number,
): CropHandle | null {
	"worklet";
	const { left, top, right, bottom } = edges;
	const { x, y } = point;
	if (x < left - radius || x > right + radius) return null;
	if (y < top - radius || y > bottom + radius) return null;
	const insideX = Math.min(radius / 2, (right - left) / 4);
	const insideY = Math.min(radius / 2, (bottom - top) / 4);
	const nearLeft = x <= left + insideX;
	const nearRight = x >= right - insideX;
	const nearTop = y <= top + insideY;
	const nearBottom = y >= bottom - insideY;
	const side = nearLeft ? "left" : nearRight ? "right" : null;
	const end = nearTop ? "top" : nearBottom ? "bottom" : null;
	if (side && end) return `${end}-${side}`;
	return side ?? end ?? "move";
}
