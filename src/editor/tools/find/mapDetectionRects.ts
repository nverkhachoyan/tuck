import type {
	DetectionFeature,
	DetectionRect,
} from "../../detection/imageDetection.ts";
import {
	cosSin,
	type Point,
	type Size,
	toDocumentSpace,
} from "../../document/geometry.ts";
import type { ImageLayer } from "../../layers/image/image.ts";
import type { RedactionBoxPlacement } from "../../layers/redaction/redaction.ts";

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
		const placement = padded && placeRect(layer, padded, document);
		return placement ? [{ sourceIndex, ...placement }] : [];
	});
}

/**
 * The boxes of a line's `words`, mapped as `mapDetectionRects` maps the
 * line, each with its index in `words`. Each reaches the line's top and
 * bottom, is padded like the line where it starts or ends the line (where a
 * recognizer can drop a letter), and less between words, so neighbors meet
 * without covering each other.
 */
export function mapWordRects(
	layer: ImageLayer,
	line: DetectionRect,
	words: readonly DetectionRect[],
	document: Size,
): MappedDetectionRect[] {
	const lefts = words.map(({ x }) => x);
	const rights = words.map(({ x, width }) => x + width);
	const first = lefts.indexOf(Math.min(...lefts));
	const last = rights.indexOf(Math.max(...rights));
	return words.flatMap((word, sourceIndex) => {
		if (word.width <= 0 || word.height <= 0) return [];
		const top = Math.min(line.y, word.y);
		const height = Math.max(line.y + line.height, word.y + word.height) - top;
		const left = sourceIndex === first ? Math.min(line.x, word.x) : word.x;
		const right =
			sourceIndex === last
				? Math.max(line.x + line.width, rights[sourceIndex])
				: rights[sourceIndex];
		const padLeft = height * (sourceIndex === first ? TEXT_PAD_X : WORD_PAD_X);
		const padRight = height * (sourceIndex === last ? TEXT_PAD_X : WORD_PAD_X);
		const padY = Math.max(2, height * TEXT_PAD_Y);
		const padded = clampToImage(layer, {
			x: left - padLeft,
			y: top - padY,
			width: right - left + padLeft + padRight,
			height: height + padY * 2,
		});
		const placement = padded && placeRect(layer, padded, document);
		return placement ? [{ sourceIndex, ...placement }] : [];
	});
}

// An image rect's box in the document, following the image's transform and
// clipped to the document; null when none of it shows.
function placeRect(
	layer: ImageLayer,
	rect: DetectionRect,
	document: Size,
): Omit<MappedDetectionRect, "sourceIndex"> | null {
	const polygon = rectCorners(rect).map((point) =>
		imagePointToDocument(layer, point),
	);
	const visible = clipToDocument(polygon, document);
	if (visible.length < 3) return null;
	const placement = orientedBounds(visible, layer.transform.rotation);
	return placement.width > 0 && placement.height > 0 ? placement : null;
}

// Text recognizers can leave a line's first or last letter out of its box
// (ML Kit drops a whole "W"), so text reaches a wide letter further each way:
// about 1.1 line heights on a line without descenders.
const TEXT_PAD_X = 1.1;
const TEXT_PAD_Y = 0.14;
// Between two words, a word's box reaches a fifth of the line's height, about
// to the middle of the space.
const WORD_PAD_X = 0.2;

function padRect(
	region: DetectionRect,
	layer: ImageLayer,
	feature: DetectionFeature,
): DetectionRect | null {
	if (region.width <= 0 || region.height <= 0) return null;
	const padX =
		feature === "faces" ? region.width * 0.14 : region.height * TEXT_PAD_X;
	const padY =
		feature === "faces"
			? region.height * 0.18
			: Math.max(2, region.height * TEXT_PAD_Y);
	return clampToImage(layer, {
		x: region.x - padX,
		y: region.y - padY,
		width: region.width + padX * 2,
		height: region.height + padY * 2,
	});
}

function clampToImage(
	layer: ImageLayer,
	rect: DetectionRect,
): DetectionRect | null {
	const x = Math.max(0, rect.x);
	const y = Math.max(0, rect.y);
	const right = Math.min(layer.width, rect.x + rect.width);
	const bottom = Math.min(layer.height, rect.y + rect.height);
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
