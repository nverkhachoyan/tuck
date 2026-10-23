import type {
	ImageLayer,
	RedactionBoxPlacement,
} from "../../../../model/document.ts";
import {
	cosSin,
	type Point,
	type Size,
	toDocumentSpace,
} from "../../../../model/geometry.ts";
import type {
	DetectionFeature,
	DetectionRect,
} from "../../detection/imageDetection.ts";

export type MappedDetectionRect = RedactionBoxPlacement & {
	sourceIndex: number;
};

/**
 * Pads detector boxes, follows the image's move/scale/rotation/flip, and clips
 * them to the visible document. The result is ready to become a redaction box.
 */
export function mapDetectionRects(
	layer: ImageLayer,
	regions: readonly DetectionRect[],
	document: Size,
	feature: DetectionFeature,
): MappedDetectionRect[] {
	return regions.flatMap((region, sourceIndex) => {
		const padded = padRect(region, layer, feature);
		if (!padded) return [];
		const polygon = rectCorners(padded).map((point) =>
			imagePointToDocument(layer, point),
		);
		const visible = clipToDocument(polygon, document);
		if (visible.length < 3) return [];
		const placement = orientedBounds(visible, layer.transform.rotation);
		return placement.width > 0 && placement.height > 0
			? [{ sourceIndex, ...placement }]
			: [];
	});
}

function padRect(
	region: DetectionRect,
	layer: ImageLayer,
	feature: DetectionFeature,
): DetectionRect | null {
	if (region.width <= 0 || region.height <= 0) return null;
	const padX =
		feature === "faces"
			? region.width * 0.14
			: Math.max(2, region.height * 0.12);
	const padY =
		feature === "faces"
			? region.height * 0.18
			: Math.max(2, region.height * 0.14);
	const x = Math.max(0, region.x - padX);
	const y = Math.max(0, region.y - padY);
	const right = Math.min(layer.width, region.x + region.width + padX);
	const bottom = Math.min(layer.height, region.y + region.height + padY);
	return right > x && bottom > y
		? { x, y, width: right - x, height: bottom - y }
		: null;
}

function rectCorners({ x, y, width, height }: DetectionRect): Point[] {
	return [
		{ x, y },
		{ x: x + width, y },
		{ x: x + width, y: y + height },
		{ x, y: y + height },
	];
}

function imagePointToDocument(layer: ImageLayer, point: Point): Point {
	const local = {
		x: point.x - layer.width / 2,
		y: point.y - layer.height / 2,
	};
	if (layer.flipped) local.x = -local.x;
	return toDocumentSpace(layer.transform, local);
}

type Edge = {
	inside: (point: Point) => boolean;
	intersection: (from: Point, to: Point) => Point;
};

function clipToDocument(polygon: Point[], { width, height }: Size): Point[] {
	const vertical = (x: number, keepGreater: boolean): Edge => ({
		inside: (point) => (keepGreater ? point.x >= x : point.x <= x),
		intersection: (from, to) => {
			const share = (x - from.x) / (to.x - from.x);
			return { x, y: from.y + (to.y - from.y) * share };
		},
	});
	const horizontal = (y: number, keepGreater: boolean): Edge => ({
		inside: (point) => (keepGreater ? point.y >= y : point.y <= y),
		intersection: (from, to) => {
			const share = (y - from.y) / (to.y - from.y);
			return { x: from.x + (to.x - from.x) * share, y };
		},
	});
	return [
		vertical(0, true),
		vertical(width, false),
		horizontal(0, true),
		horizontal(height, false),
	].reduce(clipPolygon, polygon);
}

function clipPolygon(polygon: Point[], edge: Edge): Point[] {
	if (polygon.length === 0) return polygon;
	const clipped: Point[] = [];
	let previous = polygon[polygon.length - 1];
	let previousInside = edge.inside(previous);
	for (const point of polygon) {
		const inside = edge.inside(point);
		if (inside !== previousInside) {
			clipped.push(edge.intersection(previous, point));
		}
		if (inside) clipped.push(point);
		previous = point;
		previousInside = inside;
	}
	return clipped;
}

function orientedBounds(
	polygon: Point[],
	rotation: number,
): Omit<MappedDetectionRect, "sourceIndex"> {
	const { cos, sin } = cosSin(rotation);
	const aligned = polygon.map(({ x, y }) => ({
		x: x * cos + y * sin,
		y: y * cos - x * sin,
	}));
	const xs = aligned.map(({ x }) => x);
	const ys = aligned.map(({ y }) => y);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
	return {
		width: right - left,
		height: bottom - top,
		transform: {
			x: center.x * cos - center.y * sin,
			y: center.x * sin + center.y * cos,
			scaleX: 1,
			scaleY: 1,
			rotation,
		},
	};
}
