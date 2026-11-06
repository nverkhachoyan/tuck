import {
	type Box,
	type Point,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
} from "../document/geometry.ts";
import { isFields, isPositive } from "../document/values.ts";

/**
 * A redaction's stroke: a pen covers, and an eraser uncovers what the strokes
 * before it covered. It has no color: the redaction's effect is what shows.
 */
export type MaskStroke = {
	type: "pen" | "eraser";
	width: number;
	points: number[];
};

export function isMaskStroke(value: unknown): boolean {
	return (
		isFields(value) &&
		(value.type === "pen" || value.type === "eraser") &&
		isPositive(value.width) &&
		Array.isArray(value.points) &&
		value.points.length >= 2 &&
		value.points.length % 2 === 0 &&
		value.points.every(Number.isFinite)
	);
}

/**
 * A layer made of strokes: a drawing, or a redaction painted with a brush.
 * A drawing's pens also have a color, which nothing here reads.
 */
type StrokesLayer = { transform: Transform; strokes: MaskStroke[] };

// Finer than a hundredth of a pixel is invisible, and would only make saved
// projects bigger.
const round = (value: number) => Math.round(value * 100) / 100;

type Extent = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * What a layer's pen strokes cover in its own space, or null if it has
 * none. Erasing shrinks it only by removing whole strokes (`pruneErased`).
 */
function penExtent(strokes: MaskStroke[]): Extent | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const stroke of strokes) {
		if (stroke.type !== "pen") continue;
		const reach = stroke.width / 2;
		for (let i = 0; i < stroke.points.length; i += 2) {
			minX = Math.min(minX, stroke.points[i] - reach);
			maxX = Math.max(maxX, stroke.points[i] + reach);
			minY = Math.min(minY, stroke.points[i + 1] - reach);
			maxY = Math.max(maxY, stroke.points[i + 1] + reach);
		}
	}
	return minX <= maxX ? { minX, minY, maxX, maxY } : null;
}

// Hit-testing asks for a drawing's box on every pointer move over the
// canvas, and a layer's strokes never change in place.
const boxes = new WeakMap<MaskStroke[], Box>();

/** The box around a layer's pen strokes, centered on its origin. */
export function drawingBox(layer: { strokes: MaskStroke[] }): Box {
	let box = boxes.get(layer.strokes);
	if (!box) {
		const extent = penExtent(layer.strokes);
		box = extent
			? {
					halfWidth: Math.max(-extent.minX, extent.maxX),
					halfHeight: Math.max(-extent.minY, extent.maxY),
				}
			: { halfWidth: 0, halfHeight: 0 };
		boxes.set(layer.strokes, box);
	}
	return box;
}

/**
 * `layer` with its origin moved to the middle of its pen strokes, and its
 * transform moved to match, so it draws in the same place. Its selection
 * box, and scaling and rotating it, then go around what's drawn.
 */
export function recenterDrawing<T extends StrokesLayer>(layer: T): T {
	const extent = penExtent(layer.strokes);
	if (!extent) return layer;
	const centerX = round((extent.minX + extent.maxX) / 2);
	const centerY = round((extent.minY + extent.maxY) / 2);
	if (centerX === 0 && centerY === 0) return layer;
	const { x, y } = toDocumentSpace(layer.transform, { x: centerX, y: centerY });
	return {
		...layer,
		transform: { ...layer.transform, x, y },
		strokes: layer.strokes.map((stroke) => ({
			...stroke,
			points: stroke.points.map((value, index) =>
				round(value - (index % 2 === 0 ? centerX : centerY)),
			),
		})),
	};
}

/**
 * `layer` with a stroke drawn in document space added on top, taken into the
 * layer's own space, however it's been moved, scaled, or turned since.
 */
export function addStroke<T extends StrokesLayer>(
	layer: T,
	stroke: T["strokes"][number],
): T {
	const { transform } = layer;
	const points: number[] = [];
	for (let i = 0; i < stroke.points.length; i += 2) {
		const local = toLayerSpace(transform, {
			x: stroke.points[i],
			y: stroke.points[i + 1],
		});
		points.push(round(local.x), round(local.y));
	}
	return recenterDrawing({
		...layer,
		strokes: [
			...layer.strokes,
			{ ...stroke, width: stroke.width / transform.scaleX, points },
		],
	});
}

// Hit-testing runs in gestures on the UI thread, so it's made of worklets,
// each declared above the ones that call it: worklets aren't hoisted.
function segmentDistanceSquared(from: Point, to: Point, point: Point): number {
	"worklet";
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const lengthSquared = dx * dx + dy * dy;
	const along =
		lengthSquared === 0
			? 0
			: Math.max(
					0,
					Math.min(
						1,
						((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared,
					),
				);
	const x = from.x + along * dx - point.x;
	const y = from.y + along * dy - point.y;
	return x * x + y * y;
}

/** Whether `point` is within `reach` of the line through `points`. */
export function nearLine(
	points: number[],
	point: Point,
	reach: number,
): boolean {
	"worklet";
	const reachSquared = reach * reach;
	// A dot is a line from its point to itself.
	const last = Math.max(0, points.length - 4);
	for (let i = 0; i <= last; i += 2) {
		const end = Math.min(i + 2, points.length - 2);
		const distance = segmentDistanceSquared(
			{ x: points[i], y: points[i + 1] },
			{ x: points[end], y: points[end + 1] },
			point,
		);
		if (distance <= reachSquared) return true;
	}
	return false;
}

// How close to horizontal a straightened stroke snaps flat, in radians.
const LEVEL = (5 * Math.PI) / 180;

/**
 * A stroke as the straight line from its first point to its last.
 * Within 5° of level it is horizontal, through the first point.
 */
export function straightStroke(points: number[]): number[] {
	"worklet";
	if (points.length < 4) return points;
	const x0 = points[0];
	const y0 = points[1];
	const x1 = points[points.length - 2];
	const y1 = points[points.length - 1];
	const angle = Math.atan2(y1 - y0, x1 - x0);
	const toLevel = Math.min(
		Math.abs(angle),
		Math.abs(Math.abs(angle) - Math.PI),
	);
	return [x0, y0, x1, toLevel <= LEVEL ? y0 : y1];
}

/**
 * Whether a line drawn through `points` (flattened x, y pairs in document
 * space) passes anywhere `test` says, in the layer's own space. It's checked
 * at steps no longer than `reach`, so a quick stroke, whose points land far
 * apart, can't skip over a thin line.
 */
export function segmentsNear(
	points: number[],
	transform: Transform,
	reach: number,
	test: (point: Point) => boolean,
): boolean {
	"worklet";
	let from = toLayerSpace(transform, { x: points[0], y: points[1] });
	if (test(from)) return true;
	for (let i = 2; i < points.length; i += 2) {
		const to = toLayerSpace(transform, { x: points[i], y: points[i + 1] });
		const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / reach);
		for (let step = 1; step <= steps; step++) {
			const along = step / steps;
			const point = {
				x: from.x + (to.x - from.x) * along,
				y: from.y + (to.y - from.y) * along,
			};
			if (test(point)) return true;
		}
		from = to;
	}
	return false;
}

// Whether an eraser from `strokes[from]` on clears the middle of the ink at
// `point`.
function erasedAt(strokes: MaskStroke[], from: number, point: Point): boolean {
	"worklet";
	for (let i = from; i < strokes.length; i++) {
		const stroke = strokes[i];
		if (
			stroke.type === "eraser" &&
			nearLine(stroke.points, point, stroke.width / 2)
		) {
			return true;
		}
	}
	return false;
}

// Whether the pen `strokes[index]` drew anything still showing within
// `padding` of `point`: its line is sampled where it passes that close, and
// a sample counts unless a later eraser cleared it.
function hitsPen(
	strokes: MaskStroke[],
	index: number,
	point: Point,
	padding: number,
): boolean {
	"worklet";
	const { points, width } = strokes[index];
	const reach = width / 2 + padding;
	if (!nearLine(points, point, reach)) return false;
	let erased = false;
	for (let i = index + 1; i < strokes.length && !erased; i++) {
		erased = strokes[i].type === "eraser";
	}
	if (!erased) return true;
	const gap = Math.max(width / 4, reach / 8);
	const last = Math.max(0, points.length - 4);
	for (let i = 0; i <= last; i += 2) {
		const end = Math.min(i + 2, points.length - 2);
		const fromX = points[i];
		const fromY = points[i + 1];
		const dx = points[end] - fromX;
		const dy = points[end + 1] - fromY;
		const length = Math.hypot(dx, dy);
		if (length === 0) {
			const near = Math.hypot(point.x - fromX, point.y - fromY) <= reach;
			if (near && !erasedAt(strokes, index + 1, { x: fromX, y: fromY })) {
				return true;
			}
			continue;
		}
		// The part of this segment within `reach` of the point.
		const ux = dx / length;
		const uy = dy / length;
		const along = (point.x - fromX) * ux + (point.y - fromY) * uy;
		const across = (point.x - fromX) * uy - (point.y - fromY) * ux;
		const chordSquared = reach * reach - across * across;
		if (chordSquared < 0) continue;
		const chord = Math.sqrt(chordSquared);
		const start = Math.max(0, along - chord);
		const stop = Math.min(length, along + chord);
		if (start > stop) continue;
		const steps = Math.max(1, Math.ceil((stop - start) / gap));
		for (let step = 0; step <= steps; step++) {
			const at = start + ((stop - start) * step) / steps;
			const sample = { x: fromX + ux * at, y: fromY + uy * at };
			if (!erasedAt(strokes, index + 1, sample)) return true;
		}
	}
	return false;
}

/**
 * Whether a point in a layer's own space is within `padding` of what one
 * of its pens drew and no later eraser cleared. Unlike a box, this lets a
 * tap inside a circle drawn around something, or where its ink was erased,
 * reach the layer under it.
 */
export function hitTestDrawing(
	layer: { strokes: MaskStroke[] },
	point: Point,
	padding: number,
): boolean {
	"worklet";
	const { strokes } = layer;
	for (let i = 0; i < strokes.length; i++) {
		if (strokes[i].type === "pen" && hitsPen(strokes, i, point, padding)) {
			return true;
		}
	}
	return false;
}
