import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
	withLayers,
} from "../../document/document.ts";
import { toLayerSpace } from "../../document/geometry.ts";
import type { Layer } from "../layer.ts";
import { erasesShape } from "../shape/shapeGeometry.ts";
import {
	addStroke,
	drawingBox,
	nearLine,
	recenterDrawing,
	segmentsNear,
	strokesHitBy,
} from "../strokes.ts";
import {
	createDrawingLayer,
	type DrawingLayer,
	layerBlend,
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
	const box = drawingBox(layer);
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < points.length; i += 2) {
		const local = toLayerSpace(layer.transform, {
			x: points[i],
			y: points[i + 1],
		});
		minX = Math.min(minX, local.x);
		maxX = Math.max(maxX, local.x);
		minY = Math.min(minY, local.y);
		maxY = Math.max(maxY, local.y);
	}
	return (
		maxX < -box.halfWidth - reach ||
		minX > box.halfWidth + reach ||
		maxY < -box.halfHeight - reach ||
		minY > box.halfHeight + reach
	);
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

/** The layers in `before` that `after` no longer has, bottom to top. */
export function removedLayers(
	before: EditorDocument,
	after: EditorDocument,
): Layer[] {
	const kept = new Set(after.layers.map((layer) => layer.id));
	return before.layers.filter((layer) => !kept.has(layer.id));
}
