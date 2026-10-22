// Relative `.ts` imports keep this loadable by Node's test runner.
import {
	type Box,
	type Point,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
} from "./geometry.ts";

/**
 * A redaction's stroke: a pen covers, and an eraser uncovers what the strokes
 * before it covered. It has no color: the redaction's effect is what shows.
 */
export type MaskStroke = {
	type: "pen" | "eraser";
	width: number;
	points: number[];
};

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
 * none. Erasing never shrinks it.
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
function nearLine(points: number[], point: Point, reach: number): boolean {
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

/**
 * Whether a point in a layer's own space is within `padding` of what one
 * of its pens drew. Unlike a box, this lets a tap inside a circle drawn
 * around something reach the layer under it.
 */
export function hitTestDrawing(
	layer: { strokes: MaskStroke[] },
	point: Point,
	padding: number,
): boolean {
	"worklet";
	return layer.strokes.some(
		(stroke) =>
			stroke.type === "pen" &&
			nearLine(stroke.points, point, stroke.width / 2 + padding),
	);
}
