import type { Point, Rect, Size } from "../../model/geometry.ts";

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
	"worklet";
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

/** The viewport `progress` (0 to 1) of the way from `from` to `to`. */
export function blendViewports(
	from: DocumentViewport,
	to: DocumentViewport,
	progress: number,
): DocumentViewport {
	"worklet";
	const blend = (a: number, b: number) => a + (b - a) * progress;
	return {
		scale: blend(from.scale, to.scale),
		offsetX: blend(from.offsetX, to.offsetX),
		offsetY: blend(from.offsetY, to.offsetY),
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

// However far the document is zoomed, one of its pixels is shown at most
// this many screen pixels wide, unless that's less than `MIN_MAX_ZOOM` fits.
const MAX_PIXEL_SCALE = 8;
const MIN_MAX_ZOOM = 4;

/**
 * Where a document is shown: its size, the part of the view it's fitted to
 * (the view less whatever covers it), and the margin kept inside that part.
 */
export type ViewFrame = {
	documentSize: Size;
	area: Rect;
	inset: number;
};

/**
 * How far the view is zoomed into the fitted document: `zoom` times the
 * fit, with the document point `center` in the middle of the frame's area.
 * Kept relative to the fit, so when the area changes (a tray opens, the
 * keyboard rises), the view refits around the same spot.
 */
export type ViewZoom = {
	zoom: number;
	center: Point;
};

export function areaMiddle(area: Rect): Point {
	"worklet";
	return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

function clamp(value: number, min: number, max: number): number {
	"worklet";
	return Math.min(Math.max(value, min), max);
}

// The offsets along one axis, lowest and highest, at which a document
// `extent` long on screen covers the area, less the inset, or sits in its
// middle where it's shorter.
function settledOffsets(
	extent: number,
	start: number,
	size: number,
	inset: number,
): [number, number] {
	"worklet";
	const near = start + inset;
	const far = start + size - inset - extent;
	if (far < near) return [far, near];
	const middle = (near + far) / 2;
	return [middle, middle];
}

// A scale kept between the fit and the most zooming allows.
function limitScale(fit: DocumentViewport, scale: number): number {
	"worklet";
	const max = Math.max(MAX_PIXEL_SCALE, fit.scale * MIN_MAX_ZOOM);
	return Math.min(Math.max(scale, fit.scale), max);
}

/** The document fitted to the frame's area, as `fitDocumentToView`. */
export function fitToFrame(frame: ViewFrame): DocumentViewport {
	"worklet";
	const { area } = frame;
	const fit = fitDocumentToView(frame.documentSize, area, frame.inset);
	return {
		scale: fit.scale,
		offsetX: fit.offsetX + area.x,
		offsetY: fit.offsetY + area.y,
	};
}

/**
 * Where a view settles: no smaller than the fit or larger than
 * `MAX_PIXEL_SCALE` (scaling about the area's middle), with the document
 * covering the area's width and height, less the inset, or centered in
 * either where it's smaller.
 */
export function clampViewport(
	frame: ViewFrame,
	viewport: DocumentViewport,
): DocumentViewport {
	"worklet";
	const fit = fitToFrame(frame);
	if (fit.scale <= 0 || viewport.scale <= 0) return fit;
	const { area, inset, documentSize } = frame;
	const scale = limitScale(fit, viewport.scale);
	const middle = areaMiddle(area);
	const k = scale / viewport.scale;
	const [minX, maxX] = settledOffsets(
		documentSize.width * scale,
		area.x,
		area.width,
		inset,
	);
	const [minY, maxY] = settledOffsets(
		documentSize.height * scale,
		area.y,
		area.height,
		inset,
	);
	return {
		scale,
		offsetX: clamp(middle.x - (middle.x - viewport.offsetX) * k, minX, maxX),
		offsetY: clamp(middle.y - (middle.y - viewport.offsetY) * k, minY, maxY),
	};
}

/**
 * The viewport scaled by `factor` about `point` in the view, which stays
 * over the same spot on the document. Until the view settles (see
 * `clampViewport`), the document only has to span the area's middle, so it
 * can't be lost: zooming in about a spot on it only grows it around that
 * spot, which stays under the fingers.
 */
export function zoomViewportAbout(
	frame: ViewFrame,
	viewport: DocumentViewport,
	factor: number,
	point: Point,
): DocumentViewport {
	"worklet";
	const fit = fitToFrame(frame);
	if (fit.scale <= 0 || viewport.scale <= 0) return fit;
	const { width, height } = frame.documentSize;
	const scale = limitScale(fit, viewport.scale * factor);
	const middle = areaMiddle(frame.area);
	const k = scale / viewport.scale;
	return {
		scale,
		offsetX: clamp(
			point.x - (point.x - viewport.offsetX) * k,
			middle.x - width * scale,
			middle.x,
		),
		offsetY: clamp(
			point.y - (point.y - viewport.offsetY) * k,
			middle.y - height * scale,
			middle.y,
		),
	};
}

/**
 * The viewport moved by `dx` and `dy` screen pixels, up to where a settled
 * view could be (see `clampViewport`). A zoom may have left it further out,
 * and then it only moves back toward there, without jumping.
 */
export function panViewport(
	frame: ViewFrame,
	viewport: DocumentViewport,
	dx: number,
	dy: number,
): DocumentViewport {
	"worklet";
	const fit = fitToFrame(frame);
	if (fit.scale <= 0 || viewport.scale <= 0) return fit;
	const { area, inset, documentSize } = frame;
	const { scale, offsetX, offsetY } = viewport;
	const [minX, maxX] = settledOffsets(
		documentSize.width * scale,
		area.x,
		area.width,
		inset,
	);
	const [minY, maxY] = settledOffsets(
		documentSize.height * scale,
		area.y,
		area.height,
		inset,
	);
	return {
		scale,
		offsetX: clamp(
			offsetX + dx,
			Math.min(minX, offsetX),
			Math.max(maxX, offsetX),
		),
		offsetY: clamp(
			offsetY + dy,
			Math.min(minY, offsetY),
			Math.max(maxY, offsetY),
		),
	};
}

/** The viewport a zoom shows in the frame, or the fit without one. */
export function viewportForZoom(
	frame: ViewFrame,
	zoom: ViewZoom | null,
): DocumentViewport {
	"worklet";
	const fit = fitToFrame(frame);
	if (!zoom || fit.scale <= 0) return fit;
	const scale = fit.scale * zoom.zoom;
	const middle = areaMiddle(frame.area);
	return clampViewport(frame, {
		scale,
		offsetX: middle.x - zoom.center.x * scale,
		offsetY: middle.y - zoom.center.y * scale,
	});
}

/** The zoom a viewport shows in the frame, or null at the fit. */
export function zoomForViewport(
	frame: ViewFrame,
	viewport: DocumentViewport,
): ViewZoom | null {
	"worklet";
	const fit = fitToFrame(frame);
	if (fit.scale <= 0) return null;
	const zoom = viewport.scale / fit.scale;
	// Near enough, so a pinch back out lands on the fit, and follows it.
	if (zoom < 1.01) return null;
	return {
		zoom,
		center: viewPointToDocument(viewport, areaMiddle(frame.area)),
	};
}

/**
 * The part of the document shown in the frame's area, in document space:
 * all of it at the fit, less as the view zooms in.
 */
export function visibleDocumentArea(
	frame: ViewFrame,
	viewport: DocumentViewport,
): Rect {
	const { area, documentSize } = frame;
	const { scale, offsetX, offsetY } = viewport;
	const left = Math.max(0, (area.x - offsetX) / scale);
	const top = Math.max(0, (area.y - offsetY) / scale);
	const right = Math.min(
		documentSize.width,
		(area.x + area.width - offsetX) / scale,
	);
	const bottom = Math.min(
		documentSize.height,
		(area.y + area.height - offsetY) / scale,
	);
	return { x: left, y: top, width: right - left, height: bottom - top };
}
