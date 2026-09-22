import { Platform, type ViewStyle } from "react-native";
import type { Handle } from "./handleGeometry";

// With a mouse, the canvas cursor shows what a press at the pointer would do.

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
