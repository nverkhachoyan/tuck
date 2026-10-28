import type { EditorDocument } from "../../model/document.ts";
import { type Framing, framingAnchor } from "../../model/framing.ts";
import {
	cosSin,
	normalizeAngle,
	type Point,
	type Rect,
	type Size,
} from "../../model/geometry.ts";

// The crop tool's geometry, in "crop space": the photo's own pixels, centered
// on the origin, turned and mirrored the way the canvas will show them. With
// no locked photo, the canvas stands in for one (see `framingAnchor`). The
// canvas-to-be is `box`, upright in that space; dragging it is in
// `cropDrag.ts`. Worklets, like `model/geometry.ts`, so gestures run them on
// the UI thread.

const QUARTER_TURN = Math.PI / 2;

/** How far straightening turns the photo either way, in radians. */
export const MAX_STRAIGHTEN = Math.PI / 4;

export type CropState = {
	// Clockwise quarter turns, 0–3, and the straightening on top of them.
	quarterTurns: number;
	straighten: number;
	flipped: boolean;
	box: Rect;
};

/** The crop that reproduces the document's current framing. */
export function startCrop(document: EditorDocument): CropState {
	const photo = framingAnchor(document);
	const { x, y, scaleX: scale, rotation } = photo.transform;
	const turns = Math.round(rotation / QUARTER_TURN);
	return {
		quarterTurns: ((turns % 4) + 4) % 4,
		straighten: rotation - turns * QUARTER_TURN,
		flipped: photo.flipped,
		box: {
			x: -x / scale,
			y: -y / scale,
			width: document.width / scale,
			height: document.height / scale,
		},
	};
}

/** The whole photo, upright and unflipped. */
export function resetCrop(photo: Size): CropState {
	"worklet";
	return {
		quarterTurns: 0,
		straighten: 0,
		flipped: false,
		box: {
			x: -photo.width / 2,
			y: -photo.height / 2,
			width: photo.width,
			height: photo.height,
		},
	};
}

export function cropsEqual(left: CropState, right: CropState): boolean {
	"worklet";
	return (
		left.quarterTurns === right.quarterTurns &&
		left.straighten === right.straighten &&
		left.flipped === right.flipped &&
		left.box.x === right.box.x &&
		left.box.y === right.box.y &&
		left.box.width === right.box.width &&
		left.box.height === right.box.height
	);
}

/** The photo's rotation on the canvas. */
export function cropAngle(state: CropState): number {
	"worklet";
	return normalizeAngle(state.quarterTurns * QUARTER_TURN + state.straighten);
}

/** The photo's size as the quarter turns show it, before straightening. */
export function turnedSize(photo: Size, quarterTurns: number): Size {
	"worklet";
	return quarterTurns % 2 === 0
		? photo
		: { width: photo.height, height: photo.width };
}

/** Turns everything a quarter turn counterclockwise, the box along with it. */
export function rotateLeft(state: CropState): CropState {
	"worklet";
	const { x, y, width, height } = state.box;
	return {
		...state,
		quarterTurns: (state.quarterTurns + 3) % 4,
		box: { x: y, y: -(x + width), width: height, height: width },
	};
}

/** Mirrors everything left to right, the box along with it. */
export function flipCrop(state: CropState): CropState {
	"worklet";
	return {
		...state,
		quarterTurns: (4 - state.quarterTurns) % 4,
		straighten: -state.straighten,
		flipped: !state.flipped,
		box: { ...state.box, x: -(state.box.x + state.box.width) },
	};
}

/** The photo's corners in crop space at `angle`. */
export function photoCorners(photo: Size, angle: number): Point[] {
	"worklet";
	const { cos, sin } = cosSin(angle);
	const w = photo.width / 2;
	const h = photo.height / 2;
	return [
		{ x: -w, y: -h },
		{ x: w, y: -h },
		{ x: w, y: h },
		{ x: -w, y: h },
	].map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

/** Whether the box lies on the photo at `angle`, give or take `tolerance`. */
export function isBoxOnPhoto(
	box: Rect,
	photo: Size,
	angle: number,
	tolerance = 1e-6 * (photo.width + photo.height),
): boolean {
	"worklet";
	const { cos, sin } = cosSin(angle);
	const w = photo.width / 2 + tolerance;
	const h = photo.height / 2 + tolerance;
	for (const [x, y] of [
		[box.x, box.y],
		[box.x + box.width, box.y],
		[box.x + box.width, box.y + box.height],
		[box.x, box.y + box.height],
	]) {
		// Into the photo's own, unturned space.
		const u = x * cos + y * sin;
		const v = y * cos - x * sin;
		if (Math.abs(u) > w || Math.abs(v) > h) return false;
	}
	return true;
}

/**
 * The largest share (at most 1) of a box, kept centered, that fits on the
 * photo at `angle`. 0 if its center is off the photo.
 */
function fitOnPhoto(
	center: Point,
	half: Size,
	photo: Size,
	angle: number,
): number {
	"worklet";
	const { cos, sin } = cosSin(angle);
	const w = photo.width / 2;
	const h = photo.height / 2;
	const cu = center.x * cos + center.y * sin;
	const cv = center.y * cos - center.x * sin;
	if (Math.abs(cu) > w || Math.abs(cv) > h) return 0;
	let share = 1;
	for (const [sx, sy] of [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	]) {
		const dx = sx * half.width;
		const dy = sy * half.height;
		const du = dx * cos + dy * sin;
		const dv = dy * cos - dx * sin;
		if (du > 0) share = Math.min(share, (w - cu) / du);
		if (du < 0) share = Math.min(share, (-w - cu) / du);
		if (dv > 0) share = Math.min(share, (h - cv) / dv);
		if (dv < 0) share = Math.min(share, (-h - cv) / dv);
	}
	return Math.max(0, share);
}

/**
 * Straightens to `angle`, starting from `start` (the state when the dial was
 * grabbed), so returning to its angle restores it exactly. The photo turns
 * about the box's center. A box that started on the photo shrinks to stay on
 * it, rather than showing transparent corners.
 */
export function straightenTo(
	start: CropState,
	angle: number,
	photo: Size,
): CropState {
	"worklet";
	const { box } = start;
	const turned = { ...start, straighten: angle };
	const { cos, sin } = cosSin(angle - start.straighten);
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const center = { x: cx * cos - cy * sin, y: cx * sin + cy * cos };
	let share = 1;
	if (isBoxOnPhoto(box, photo, cropAngle(start))) {
		const half = { width: box.width / 2, height: box.height / 2 };
		share = fitOnPhoto(center, half, photo, cropAngle(turned));
	}
	const width = box.width * share;
	const height = box.height * share;
	return {
		...turned,
		box: {
			x: center.x - width / 2,
			y: center.y - height / 2,
			width,
			height,
		},
	};
}

/** The largest box with `ratio` (width / height) inside `box`, centered in it. */
export function boxWithRatio(box: Rect, ratio: number): Rect {
	"worklet";
	const width = Math.min(box.width, box.height * ratio);
	const height = width / ratio;
	return {
		x: box.x + (box.width - width) / 2,
		y: box.y + (box.height - height) / 2,
		width,
		height,
	};
}

/** What the crop tool shows: the turned photo and the box around it. */
export function cropViewBounds(state: CropState, photo: Size): Rect {
	"worklet";
	const corners = photoCorners(photo, cropAngle(state));
	const { box } = state;
	let left = box.x;
	let top = box.y;
	let right = box.x + box.width;
	let bottom = box.y + box.height;
	for (const corner of corners) {
		left = Math.min(left, corner.x);
		top = Math.min(top, corner.y);
		right = Math.max(right, corner.x);
		bottom = Math.max(bottom, corner.y);
	}
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The framing a finished crop gives the document. `scale` is the photo's
 * pixels per canvas pixel, which cropping keeps. The box's edges land on
 * whole canvas pixels, inward while it's on the photo, so a crop never picks
 * up a sliver of transparency.
 */
export function cropFraming(
	state: CropState,
	photo: Size,
	scale: number,
	background: string | null,
): Framing {
	const angle = cropAngle(state);
	const turned = turnedSize(photo, state.quarterTurns);
	const onPhoto = isBoxOnPhoto(state.box, photo, angle);
	// Whole canvas pixels from the photo's turned corner. A millionth of a
	// pixel of rounding error doesn't cost one.
	const toPixels = (value: number, origin: number, inward: -1 | 1) => {
		const pixels = (value - origin) * scale;
		if (!onPhoto) return Math.round(pixels);
		return inward > 0 ? Math.ceil(pixels - 1e-6) : Math.floor(pixels + 1e-6);
	};
	const { x, y, width, height } = state.box;
	const originX = -turned.width / 2;
	const originY = -turned.height / 2;
	const left = toPixels(x, originX, 1);
	const top = toPixels(y, originY, 1);
	const right = Math.max(left + 1, toPixels(x + width, originX, -1));
	const bottom = Math.max(top + 1, toPixels(y + height, originY, -1));
	return {
		width: right - left,
		height: bottom - top,
		background,
		flipped: state.flipped,
		transform: {
			x: -originX * scale - left,
			y: -originY * scale - top,
			scaleX: scale,
			scaleY: scale,
			rotation: angle,
		},
	};
}
