import type { Point, Rect, Size } from "../model/geometry.ts";

export type DocumentViewport = {
	scale: number;
	offsetX: number;
	offsetY: number;
};

/**
 * Describes how a document is centered and aspect-fitted inside a view,
 * at least `inset` from each edge.
 */
export function fitDocumentToView(
	documentSize: Size,
	viewSize: Size,
	inset = 0,
): DocumentViewport {
	const width = viewSize.width - inset * 2;
	const height = viewSize.height - inset * 2;
	if (width <= 0 || height <= 0) {
		return { scale: 0, offsetX: 0, offsetY: 0 };
	}

	const scale = Math.min(
		width / documentSize.width,
		height / documentSize.height,
	);
	return {
		scale,
		offsetX: (viewSize.width - documentSize.width * scale) / 2,
		offsetY: (viewSize.height - documentSize.height * scale) / 2,
	};
}

/** `fitDocumentToView` for a rectangle anywhere, not only at the origin. */
export function fitRectToView(
	bounds: Rect,
	viewSize: Size,
	inset = 0,
): DocumentViewport {
	const { scale, offsetX, offsetY } = fitDocumentToView(
		bounds,
		viewSize,
		inset,
	);
	return {
		scale,
		offsetX: offsetX - bounds.x * scale,
		offsetY: offsetY - bounds.y * scale,
	};
}

/**
 * Converts a point reported by the view into document-space coordinates.
 * A worklet, so gestures can convert touch points on the UI thread.
 */
export function viewPointToDocument(
	viewport: DocumentViewport,
	point: Point,
): Point {
	"worklet";
	return {
		x: (point.x - viewport.offsetX) / viewport.scale,
		y: (point.y - viewport.offsetY) / viewport.scale,
	};
}

/** The part of document space visible inside a view, optionally inset. */
export function viewRectToDocument(
	viewport: DocumentViewport,
	viewSize: Size,
	inset = 0,
): Rect {
	"worklet";
	const { scale, offsetX, offsetY } = viewport;
	return {
		x: (inset - offsetX) / scale,
		y: (inset - offsetY) / scale,
		width: (viewSize.width - inset * 2) / scale,
		height: (viewSize.height - inset * 2) / scale,
	};
}
