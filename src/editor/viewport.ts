import type { Point, Size } from "../model/geometry.ts";

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
