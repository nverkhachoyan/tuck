import type { Point } from "../../lib/hit-test";

export type Size = {
	width: number;
	height: number;
};

export type DocumentViewport = {
	scale: number;
	offsetX: number;
	offsetY: number;
};

/** Describes how a document is centered and aspect-fitted inside a view. */
export function fitDocumentToView(
	documentSize: Size,
	viewSize: Size,
): DocumentViewport {
	if (viewSize.width <= 0 || viewSize.height <= 0) {
		return { scale: 0, offsetX: 0, offsetY: 0 };
	}

	const scale = Math.min(
		viewSize.width / documentSize.width,
		viewSize.height / documentSize.height,
	);
	return {
		scale,
		offsetX: (viewSize.width - documentSize.width * scale) / 2,
		offsetY: (viewSize.height - documentSize.height * scale) / 2,
	};
}

/** Converts a point reported by the view into document-space coordinates. */
export function viewPointToDocument(
	viewport: DocumentViewport,
	point: Point,
): Point {
	return {
		x: (point.x - viewport.offsetX) / viewport.scale,
		y: (point.y - viewport.offsetY) / viewport.scale,
	};
}
