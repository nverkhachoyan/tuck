import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
	replaceLayer,
	withLayers,
} from "../../document/document.ts";
import { type Point, toLayerSpace } from "../../document/geometry.ts";
import { createLayerId, identityTransform } from "../base.ts";
import type { Layer } from "../layer.ts";
import { erasesShape } from "../shape/shapeGeometry.ts";
import {
	addStroke,
	boxesOverlap,
	drawingBox,
	erasedAt,
	lineBox,
	nearLine,
	recenterDrawing,
	segmentsNear,
	strokesHitBy,
} from "../strokes.ts";
import {
	createDrawingLayer,
	type DrawingLayer,
	layerBlend,
	type PenTip,
	pruneErased,
	type Stroke,
	strokeBlend,
	visibleReach,
} from "./drawing.ts";

/**
 * A pen stroke in document space joins the mark `joinId` when it's an
 * unlocked drawing that composites the same way, or starts a new mark on
 * top. Which mark to join is the caller's (`continuesMark`).
 */
export function drawStroke(
	document: EditorDocument,
	joinId: string | null,
	stroke: Stroke & { type: "pen" },
): EditorDocument {
	if (stroke.points.length < 2) return document;
	const joined = findLayer(document, joinId);
	if (
		joined?.type === "drawing" &&
		!joined.locked &&
		strokeBlend(stroke) === layerBlend(joined)
	) {
		return withLayers(
			document,
			document.layers.map((layer) =>
				layer === joined ? addStroke(joined, stroke) : layer,
			),
		);
	}
	return addLayerOnTop(document, createDrawingLayer(stroke));
}

// Whether a path in document space stays clear of a drawing's box, padded
// by `reach` in the layer's space.
function missesBox(
	layer: DrawingLayer,
	points: number[],
	reach: number,
): boolean {
	const { halfWidth, halfHeight } = drawingBox(layer);
	const local: number[] = [];
	for (let i = 0; i < points.length; i += 2) {
		const { x, y } = toLayerSpace(layer.transform, {
			x: points[i],
			y: points[i + 1],
		});
		local.push(x, y);
	}
	return !boxesOverlap(lineBox(local, 0), {
		minX: -halfWidth - reach,
		minY: -halfHeight - reach,
		maxX: halfWidth + reach,
		maxY: halfHeight + reach,
	});
}

// Whether an eraser stroke in document space passes over any of a
// drawing's pens, generously: within its half width plus how far each
// pen's ink reaches, so nothing cleared live comes back once it lands.
function erasesDrawing(
	layer: DrawingLayer,
	stroke: Stroke & { type: "eraser" },
): boolean {
	const { transform } = layer;
	const half = stroke.width / 2 / transform.scaleX;
	const pens = layer.strokes.filter((pen) => pen.type === "pen");
	if (pens.length === 0) return false;
	const reach = half + Math.max(...pens.map(visibleReach));
	if (missesBox(layer, stroke.points, reach)) return false;
	return segmentsNear(stroke.points, transform, half, (point) =>
		pens.some((pen) => nearLine(pen.points, point, half + visibleReach(pen))),
	);
}

/**
 * An eraser stroke in document space, through every unlocked, visible
 * drawing it passes over, or only `scope`'s when given:
 * - it joins each, and strokes it leaves pointless are dropped
 *   (`pruneErased`); a drawing left with no ink is removed;
 * - with no `scope`, each unlocked, visible shape it passes over is removed
 *   whole, in the same edit: a shape is one mark, never left in pieces;
 * - photos, text, stickers, and redactions are never touched.
 * The same document when nothing changed.
 */
export function eraseStroke(
	document: EditorDocument,
	stroke: Stroke & { type: "eraser" },
	scope: string | null,
): EditorDocument {
	if (stroke.points.length < 2) return document;
	let changed = false;
	const layers: Layer[] = [];
	for (const layer of document.layers) {
		if (layer.locked || layer.hidden) {
			layers.push(layer);
		} else if (
			layer.type === "drawing" &&
			(scope === null || layer.id === scope) &&
			erasesDrawing(layer, stroke)
		) {
			changed = true;
			const erased = addStroke(layer, stroke);
			const strokes = pruneErased(erased.strokes);
			if (strokes.some((kept) => kept.type === "pen")) {
				layers.push(
					strokes === erased.strokes
						? erased
						: recenterDrawing({ ...erased, strokes }),
				);
			}
		} else if (
			layer.type === "shape" &&
			scope === null &&
			erasesShape(layer, stroke.points, stroke.width)
		) {
			changed = true;
		} else {
			layers.push(layer);
		}
	}
	return changed ? withLayers(document, layers) : document;
}

/**
 * A Stroke eraser's path in document space, `reach` the touch's in document
 * units, through every unlocked, visible drawing it passes over, or only
 * `scope`'s when given:
 * - each pen stroke whose remaining ink it touches (`strokesHitBy`), and
 *   `removes` allows, goes whole; strokes left pointless are dropped
 *   (`pruneErased`), and a drawing left with no ink is removed;
 * - with no `scope`, each unlocked, visible shape it passes over goes
 *   whole, as with `eraseStroke`;
 * - it writes no eraser stroke, and never touches another layer type.
 * The same document when nothing changed.
 */
export function eraseWholeStrokes(
	document: EditorDocument,
	points: number[],
	reach: number,
	scope: string | null,
	removes: (stroke: Stroke) => boolean = () => true,
): EditorDocument {
	if (points.length < 2) return document;
	let changed = false;
	const layers: Layer[] = [];
	for (const layer of document.layers) {
		if (layer.locked || layer.hidden) {
			layers.push(layer);
			continue;
		}
		if (layer.type === "drawing" && (scope === null || layer.id === scope)) {
			const hit = missesBox(layer, points, reach / layer.transform.scaleX)
				? []
				: strokesHitBy(layer.strokes, layer.transform, points, reach).filter(
						(index) => removes(layer.strokes[index]),
					);
			if (hit.length === 0) {
				layers.push(layer);
				continue;
			}
			changed = true;
			const strokes = pruneErased(
				layer.strokes.filter((_, index) => !hit.includes(index)),
			);
			if (strokes.some((kept) => kept.type === "pen")) {
				layers.push(recenterDrawing({ ...layer, strokes }));
			}
		} else if (
			layer.type === "shape" &&
			scope === null &&
			erasesShape(layer, points, reach * 2)
		) {
			changed = true;
		} else {
			layers.push(layer);
		}
	}
	return changed ? withLayers(document, layers) : document;
}

// The point on the line through `points` nearest `point`.
function nearestOnLine(points: number[], point: Point): Point {
	let best = { x: points[0], y: points[1] };
	let bestDistance = Number.POSITIVE_INFINITY;
	const last = Math.max(0, points.length - 4);
	for (let i = 0; i <= last; i += 2) {
		const end = Math.min(i + 2, points.length - 2);
		const fromX = points[i];
		const fromY = points[i + 1];
		const dx = points[end] - fromX;
		const dy = points[end + 1] - fromY;
		const lengthSquared = dx * dx + dy * dy;
		const along =
			lengthSquared === 0
				? 0
				: Math.max(
						0,
						Math.min(
							1,
							((point.x - fromX) * dx + (point.y - fromY) * dy) / lengthSquared,
						),
					);
		const x = fromX + along * dx;
		const y = fromY + along * dy;
		const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
		if (distance < bestDistance) {
			bestDistance = distance;
			best = { x, y };
		}
	}
	return best;
}

// Whether two pen strokes' visible ink meets somewhere no later eraser
// cleared: sampled along `a` at a quarter of its width, against the nearest
// point on `b`.
function inkTouches(strokes: Stroke[], a: number, b: number): boolean {
	const first = strokes[a];
	const second = strokes[b];
	const reach = visibleReach(first) + visibleReach(second);
	if (
		!boxesOverlap(
			lineBox(first.points, visibleReach(first)),
			lineBox(second.points, visibleReach(second)),
		)
	) {
		return false;
	}
	const step = Math.max(first.width / 4, 0.5);
	return segmentsNear(first.points, identityTransform, step, (point) => {
		const near = nearestOnLine(second.points, point);
		if (Math.hypot(near.x - point.x, near.y - point.y) > reach) return false;
		return !erasedAt(strokes, a + 1, point) && !erasedAt(strokes, b + 1, near);
	});
}

// A drawing's strokes never change in place, so its pieces are worked out
// once.
const pieces = new WeakMap<Stroke[], number[][]>();

/**
 * The indexes of a drawing's pen strokes, grouped into pieces: strokes
 * whose visible ink meets where no later eraser cleared it are one piece,
 * and so are chains of them. A stroke the Eraser broke in two stays one
 * stroke, so its halves stay in one piece. In the order they were drawn.
 */
export function drawingPieces(layer: DrawingLayer): number[][] {
	const cached = pieces.get(layer.strokes);
	if (cached) return cached;
	const { strokes } = layer;
	const pens = strokes.flatMap((stroke, index) =>
		stroke.type === "pen" ? [index] : [],
	);
	const parent = new Map(pens.map((index) => [index, index]));
	const root = (index: number): number => {
		let at = index;
		while (parent.get(at) !== at) at = parent.get(at) ?? at;
		return at;
	};
	for (let i = 0; i < pens.length; i++) {
		for (let j = i + 1; j < pens.length; j++) {
			const a = root(pens[i]);
			const b = root(pens[j]);
			if (a !== b && inkTouches(strokes, pens[i], pens[j])) {
				parent.set(Math.max(a, b), Math.min(a, b));
			}
		}
	}
	const groups = new Map<number, number[]>();
	for (const index of pens) {
		const key = root(index);
		groups.set(key, [...(groups.get(key) ?? []), index]);
	}
	const result = [...groups.values()];
	pieces.set(layer.strokes, result);
	return result;
}

// Whether an eraser stroke passes over a pen stroke drawn before it.
function erases(strokes: Stroke[], eraser: number, pen: number): boolean {
	if (pen > eraser) return false;
	const { points, width } = strokes[eraser];
	const reach = width / 2 + visibleReach(strokes[pen]);
	const step = Math.max(width / 4, 0.5);
	return segmentsNear(points, identityTransform, step, (point) =>
		nearLine(strokes[pen].points, point, reach),
	);
}

/**
 * The drawing `id` split into one drawing per piece (`drawingPieces`), in
 * its place in the stack, in the order the pieces were drawn:
 * - each keeps its transform, blend, and visibility, and holds its pen
 *   strokes and every eraser stroke over one of them, in their order, so
 *   it draws as it did;
 * - the first keeps the id, so the selection and its row stay put.
 * The same document for a drawing in one piece, a locked one, or none.
 */
export function separateDrawing(
	document: EditorDocument,
	id: string,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "drawing" || target.locked) return document;
	const groups = drawingPieces(target);
	if (groups.length < 2) return document;
	const { strokes } = target;
	const split = groups.map((group, n): DrawingLayer => {
		const kept = strokes.filter(
			(stroke, index) =>
				group.includes(index) ||
				(stroke.type === "eraser" &&
					group.some((pen) => erases(strokes, index, pen))),
		);
		return recenterDrawing({
			...target,
			id: n === 0 ? target.id : createLayerId("drawing"),
			strokes: kept,
		});
	});
	return withLayers(
		document,
		document.layers.flatMap((layer) => (layer === target ? split : [layer])),
	);
}

/** What restyling a mark changes; `tip: null` is the round pen. */
export type MarkPatch = {
	color?: string;
	tip?: PenTip | null;
	width?: number;
};

/**
 * Every pen stroke of the drawing `id` restyled with `patch`:
 * - `width` is in document units, divided by the layer's scale;
 * - a new tip sets the layer's blend (a highlight multiplies);
 * - eraser strokes stay as they are, so what was erased stays erased;
 * - the drawing recenters, since widths move its box.
 * The same document when nothing changes, or the drawing is locked or gone.
 */
export function restyleDrawing(
	document: EditorDocument,
	id: string,
	patch: MarkPatch,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "drawing" || target.locked) return document;
	const width =
		patch.width === undefined
			? undefined
			: patch.width / target.transform.scaleX;
	let changed = false;
	const strokes = target.strokes.map((stroke): Stroke => {
		if (stroke.type !== "pen") return stroke;
		const color = patch.color ?? stroke.color;
		const tip = patch.tip === undefined ? stroke.tip : (patch.tip ?? undefined);
		const nextWidth = width ?? stroke.width;
		if (
			color === stroke.color &&
			tip === stroke.tip &&
			nextWidth === stroke.width
		) {
			return stroke;
		}
		changed = true;
		const { tip: _, ...rest } = stroke;
		return tip === undefined
			? { ...rest, color, width: nextWidth }
			: { ...rest, color, width: nextWidth, tip };
	});
	if (!changed) return document;
	const blend =
		patch.tip === undefined
			? layerBlend(target)
			: strokeBlend({
					type: "pen",
					color: "",
					width: 1,
					tip: patch.tip ?? undefined,
				});
	const { blend: __, ...rest } = target;
	const restyled: DrawingLayer = recenterDrawing({
		...rest,
		strokes,
		...(blend ? { blend } : {}),
	});
	return replaceLayer(document, target, restyled);
}

/** The layers in `before` that `after` no longer has, bottom to top. */
export function removedLayers(
	before: EditorDocument,
	after: EditorDocument,
): Layer[] {
	const kept = new Set(after.layers.map((layer) => layer.id));
	return before.layers.filter((layer) => !kept.has(layer.id));
}
