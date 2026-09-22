import { Platform, type ViewStyle } from "react-native";
import { layoutTextLayer, selectionPadding } from "@/layers/textLayerLayout";
import type { TextLayer } from "@/model/document";
import {
	type Box,
	type Handle,
	handleAt,
	type Point,
	type Transform,
} from "@/model/geometry";

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

/** The selection box of a text layer (its text plus padding), in local units. */
export function selectionBox(layer: TextLayer): Box {
	const { width, height } = layoutTextLayer(layer);
	const pad = selectionPadding(layer);
	return { halfWidth: width / 2 + pad, halfHeight: height / 2 + pad };
}

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

export type CanvasCursor =
	| "default"
	| "move"
	| "ew-resize"
	| "nwse-resize"
	| "ns-resize"
	| "nesw-resize"
	| "rotate";

const RESIZE_CURSORS = [
	"ew-resize",
	"nwse-resize",
	"ns-resize",
	"nesw-resize",
] as const;

// Each corner's outward diagonal before rotation (y points down).
const CORNER_ANGLES: Record<Exclude<Handle, "rotate">, number> = {
	"top-left": (-3 * Math.PI) / 4,
	"top-right": -Math.PI / 4,
	"bottom-right": Math.PI / 4,
	"bottom-left": (3 * Math.PI) / 4,
};

/**
 * The cursor for a handle. Browsers only have resize arrows in four
 * directions, so a rotated corner gets whichever is closest to its diagonal.
 */
export function cursorForHandle(
	handle: Handle,
	rotation: number,
): CanvasCursor {
	if (handle === "rotate") return "rotate";
	const degrees = ((CORNER_ANGLES[handle] + rotation) * 180) / Math.PI;
	// Arrows point both ways, so only the axis (mod 180°) matters.
	const axis = ((degrees % 180) + 180) % 180;
	return RESIZE_CURSORS[Math.round(axis / 45) % 4];
}

// Browsers have no rotate cursor, so draw one: a circular arrow, white over
// a dark outline so it shows on any photo. Falls back to a grab hand.
const rotateIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#000" stroke-width="4"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M12.9 7.1H17V3"/></g><g stroke="#fff" stroke-width="2"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M12.9 7.1H17V3"/></g></svg>`;
const rotateCursor = `url("data:image/svg+xml,${encodeURIComponent(rotateIcon)}") 12 12, grab`;

/**
 * The canvas style that shows a cursor. Only web has one, and React Native's
 * types only know "auto" and "pointer", hence the cast.
 */
export function cursorStyle(cursor: CanvasCursor): ViewStyle | undefined {
	if (Platform.OS !== "web") return undefined;
	const css = cursor === "rotate" ? rotateCursor : cursor;
	return { cursor: css } as unknown as ViewStyle;
}
