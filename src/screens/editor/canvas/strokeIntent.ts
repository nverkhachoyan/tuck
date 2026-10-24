import {
	type Point,
	type Rect,
	rectFromCorners,
	type Size,
} from "../../../model/geometry.ts";
import {
	isLineShape,
	type ShapePlacement,
} from "../../../model/layers/shape.ts";
import type { CanvasTool } from "./canvasInput.ts";
import { shapeFromDrag } from "./shapeDrag.ts";

// A box or a line dragged no further than this either way, in screen
// pixels, was a tap; a box this thin in only one way is dropped.
export const TAP_SLOP_PX = 6;

/** What a finished stroke with a tool asks for. */
export type StrokeIntent =
	// The color under the stroke's end, or the subject under a tap.
	| { type: "pick"; point: Point }
	// A tap off the document, which puts the tool down.
	| { type: "tapAway"; point: Point }
	| { type: "paint" }
	| { type: "box"; rect: Rect }
	| { type: "shape"; placement: ShapePlacement }
	// A tap on the document, which selects the layer of `kind` under it, a
	// box to restyle, or else nothing.
	| { type: "select"; point: Point; kind: "redaction" | "shape" }
	// A box too thin to show, which is dropped rather than taken for a tap.
	| { type: "none" };

/**
 * What a stroke of at least one point pair means for `tool`: its `points`
 * are flat pairs in document space, measured against the tap slop at the
 * view's `scale`.
 */
export function strokeIntent(
	tool: CanvasTool,
	points: number[],
	scale: number,
	documentSize: Size,
): StrokeIntent {
	const end = { x: points[points.length - 2], y: points[points.length - 1] };
	if (tool.type === "pickColor") return { type: "pick", point: end };
	const start = { x: points[0], y: points[1] };
	if (
		!insideDocument(documentSize, start) &&
		staysWithin(points, TAP_SLOP_PX / scale)
	) {
		return { type: "tapAway", point: start };
	}
	if (tool.type === "pickSubject") {
		return staysWithin(points, TAP_SLOP_PX / scale)
			? { type: "pick", point: start }
			: { type: "none" };
	}
	if (tool.type !== "redactBox" && tool.type !== "drawShape") {
		return { type: "paint" };
	}
	const line = tool.type === "drawShape" && isLineShape(tool.shape);
	const box = rectFromCorners(start, end);
	if (Math.max(box.width, box.height) * scale < TAP_SLOP_PX) {
		const kind = tool.type === "redactBox" ? "redaction" : "shape";
		return { type: "select", point: start, kind };
	}
	if (!line && Math.min(box.width, box.height) * scale < TAP_SLOP_PX) {
		return { type: "none" };
	}
	return tool.type === "redactBox"
		? { type: "box", rect: box }
		: { type: "shape", placement: shapeFromDrag(tool.shape, start, end) };
}

export function insideDocument(size: Size, point: Point): boolean {
	return (
		point.x >= 0 &&
		point.y >= 0 &&
		point.x <= size.width &&
		point.y <= size.height
	);
}

/** Whether a stroke's points, flat pairs, all stay within `slop` of its first. */
function staysWithin(points: number[], slop: number): boolean {
	for (let i = 2; i < points.length; i += 2) {
		if (Math.hypot(points[i] - points[0], points[i + 1] - points[1]) > slop) {
			return false;
		}
	}
	return true;
}
