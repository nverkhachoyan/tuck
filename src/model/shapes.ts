import {
	isLine,
	type LineShapeKind,
	type MaskStroke,
	type ShapeLayer,
} from "./document.ts";
import { hitTestDrawing } from "./drawing.ts";
import { type Box, toLayerSpace } from "./geometry.ts";

// An arrow's head, in its line's thickness: how far back from the tip it
// runs, and how far it spreads to each side at its base.
const ARROW_HEAD_LENGTH = 4.5;
const ARROW_HEAD_SPREAD = 2.5;
// Straight sides around an ellipse, for hit testing: enough that a tap near
// its curve is near one of them.
const ELLIPSE_SEGMENTS = 48;

/**
 * An arrow's head on a line `length` long: how far back from the tip it
 * runs, and its half width at its base. A short arrow's head shrinks to
 * half its length.
 */
export function arrowHead(
	strokeWidth: number,
	length: number,
): { length: number; halfWidth: number } {
	"worklet";
	const full = strokeWidth * ARROW_HEAD_LENGTH;
	const head = Math.min(full, length / 2);
	return {
		length: head,
		halfWidth: strokeWidth * ARROW_HEAD_SPREAD * (head / full),
	};
}

/**
 * How far a line reaches to either side of its middle, however long it is:
 * half its thickness, or an arrow's head at its widest.
 */
export function lineReach(shape: LineShapeKind, strokeWidth: number): number {
	"worklet";
	return shape === "arrow" ? strokeWidth * ARROW_HEAD_SPREAD : strokeWidth / 2;
}

/** The box a shape covers in its own space, centered on its origin. */
export function shapeBox(layer: ShapeLayer): Box {
	return isLine(layer)
		? {
				halfWidth: layer.length / 2,
				halfHeight: lineReach(layer.shape, layer.strokeWidth),
			}
		: { halfWidth: layer.width / 2, halfHeight: layer.height / 2 };
}

/**
 * An outline's thickness in a box: its stroke's, unless the box is thinner,
 * which it then fills.
 */
export function outlineThickness(box: Box, strokeWidth: number): number {
	"worklet";
	return Math.min(strokeWidth, box.halfWidth * 2, box.halfHeight * 2);
}

// A layer's outline never changes in place, and hit testing asks for it on
// every pointer move over the canvas.
const outlines = new WeakMap<ShapeLayer, MaskStroke[]>();

/**
 * What a shape draws, as strokes along its middle in its own space, to hit
 * test against (see `hitTestDrawing`): a tap inside a rectangle drawn around
 * something reaches what's under it. An arrow's head is a stroke as wide as
 * the head.
 */
export function shapeOutline(layer: ShapeLayer): MaskStroke[] {
	let strokes = outlines.get(layer);
	if (!strokes) {
		strokes = outlineStrokes(layer);
		outlines.set(layer, strokes);
	}
	return strokes;
}

function outlineStrokes(layer: ShapeLayer): MaskStroke[] {
	const box = shapeBox(layer);
	const { strokeWidth } = layer;
	if (isLine(layer)) {
		const end = Math.max(0, box.halfWidth - strokeWidth / 2);
		const line: MaskStroke = {
			type: "pen",
			width: strokeWidth,
			points: [-end, 0, end, 0],
		};
		if (layer.shape === "line") return [line];
		const head = arrowHead(strokeWidth, layer.length);
		const tip = box.halfWidth;
		return [
			line,
			{
				type: "pen",
				width: head.halfWidth * 2,
				points: [tip - head.length, 0, tip, 0],
			},
		];
	}
	const thickness = outlineThickness(box, strokeWidth);
	const a = box.halfWidth - thickness / 2;
	const b = box.halfHeight - thickness / 2;
	const points: number[] = [];
	if (layer.shape === "rectangle") {
		points.push(-a, -b, a, -b, a, b, -a, b, -a, -b);
	} else {
		for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
			const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
			points.push(a * Math.cos(angle), b * Math.sin(angle));
		}
	}
	return [{ type: "pen", width: thickness, points }];
}

/**
 * Whether an eraser `width` across, drawn through `points` (flattened x, y
 * pairs in document space), passes over what a shape draws. It's checked at
 * steps no longer than the eraser's reach, so a quick stroke, whose points
 * land far apart, can't skip over a thin line.
 */
export function erasesShape(
	layer: ShapeLayer,
	points: number[],
	width: number,
): boolean {
	const { transform } = layer;
	const outline = { strokes: shapeOutline(layer) };
	const reach = width / 2 / transform.scaleX;
	const at = (i: number) =>
		toLayerSpace(transform, { x: points[i], y: points[i + 1] });
	let from = at(0);
	if (hitTestDrawing(outline, from, reach)) return true;
	for (let i = 2; i < points.length; i += 2) {
		const to = at(i);
		const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / reach);
		for (let step = 1; step <= steps; step++) {
			const along = step / steps;
			const point = {
				x: from.x + (to.x - from.x) * along,
				y: from.y + (to.y - from.y) * along,
			};
			if (hitTestDrawing(outline, point, reach)) return true;
		}
		from = to;
	}
	return false;
}
