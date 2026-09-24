import { Platform } from "react-native";
import type { Box, Point, Transform } from "@/model/geometry";
import { type Handle, handleAt } from "./handleGeometry";

// The selection handles' platform-dependent side: their sizes for a mouse or
// a finger, and whether they show. The math is in `handleGeometry.ts`.

/**
 * How the selected layer's corner (scale) and knob (rotate) handles look and
 * respond, shared by the gesture, the renderer, and the pointer cursor.
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

/**
 * Whether the handles are shown (and grabbable). A mouse always gets them.
 * On touch they'd cover small text, leaving nothing to drag it by, so they
 * only appear once the box is at least two touch targets tall on screen;
 * smaller text is still scaled and rotated with two fingers.
 */
export function handlesVisible(
	box: Box,
	scale: number,
	viewScale: number,
): boolean {
	"worklet";
	if (hasFinePointer) return true;
	const shortSide =
		2 * Math.min(box.halfWidth, box.halfHeight) * scale * viewScale;
	return shortSide >= 2 * handleMetrics.hitRadius;
}

/** The visible handle under a document-space point, if any. */
export function handleUnder(
	transform: Transform,
	box: Box,
	point: Point,
	viewScale: number,
): Handle | null {
	"worklet";
	if (!handlesVisible(box, transform.scaleX, viewScale)) return null;
	return handleAt(
		transform,
		box,
		point,
		handleMetrics.hitRadius / viewScale,
		handleMetrics.knobOffset / viewScale,
	);
}
