import { Platform } from "react-native";
import type { Box, Point, Transform } from "@/model/geometry";
import { CORNERS, type Handle, handleAt } from "./handleGeometry";

// The selection handles' platform-dependent side: their sizes for a mouse or
// a finger, and whether they show. The math is in `handleGeometry.ts`.

/**
 * How the selected layer's corner (scale), side (resize), and knob (rotate)
 * handles look and respond, shared by the gesture, the renderer, and the pointer cursor.
 * Sizes are in screen pixels, so handles look the same at any zoom.
 */
type HandleMetrics = {
	// Drawn size of a corner square; the knob is a circle of similar size.
	size: number;
	// How close a press must be to grab a handle.
	hitRadius: number;
	// Gap between the top edge and the rotate knob.
	knobOffset: number;
};

// A mouse or trackpad: precise, and it can hover to show cursors.
export const hasFinePointer =
	Platform.OS === "web" &&
	typeof window !== "undefined" &&
	window.matchMedia("(pointer: fine)").matches;

export const handleMetrics: HandleMetrics = hasFinePointer
	? { size: 9, hitRadius: 8, knobOffset: 22 }
	: // Drawn small so they don't smother the text, but grabbable from 22pt
		// away: half of the 44pt minimum comfortable touch target.
		{ size: 10, hitRadius: 22, knobOffset: 30 };

const ALL_HANDLES: readonly Handle[] = [
	...CORNERS,
	"top",
	"right",
	"bottom",
	"left",
	"rotate",
];
const CORNERS_AND_KNOB: readonly Handle[] = [...CORNERS, "rotate"];

/**
 * The handles shown (and grabbable), with side handles only on a box that's
 * `resizable`. A mouse always gets them all. On touch they'd cover small
 * text, leaving nothing to drag it by, so the corners and knob only appear
 * once the box is at least two touch targets tall on screen; smaller text
 * is still scaled and rotated with two fingers. A pair of side handles
 * appears once the box is four targets long between them, which leaves two
 * to drag it by, so a thin box over a line of text can still be stretched.
 */
export function shownHandles(
	box: Box,
	scaleX: number,
	scaleY: number,
	viewScale: number,
	resizable: boolean,
): readonly Handle[] {
	"worklet";
	if (hasFinePointer) return resizable ? ALL_HANDLES : CORNERS_AND_KNOB;
	const target = 2 * handleMetrics.hitRadius;
	const width = 2 * box.halfWidth * scaleX * viewScale;
	const height = 2 * box.halfHeight * scaleY * viewScale;
	const handles: Handle[] =
		Math.min(width, height) >= target ? [...CORNERS_AND_KNOB] : [];
	if (resizable && height >= target * 2) handles.push("top", "bottom");
	if (resizable && width >= target * 2) handles.push("left", "right");
	return handles;
}

/**
 * The shown handle under a document-space point, if any (see
 * `shownHandles`).
 */
export function handleUnder(
	transform: Transform,
	box: Box,
	resizable: boolean,
	point: Point,
	viewScale: number,
): Handle | null {
	"worklet";
	return handleAt(
		transform,
		box,
		point,
		handleMetrics.hitRadius / viewScale,
		handleMetrics.knobOffset / viewScale,
		shownHandles(box, transform.scaleX, transform.scaleY, viewScale, resizable),
	);
}
