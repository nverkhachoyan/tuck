import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
	replaceLayer,
	withLayers,
} from "../document.ts";
import {
	createDrawingLayer,
	layerBlend,
	type Stroke,
	strokeBlend,
} from "../layers/drawing.ts";
import {
	createShapeLayer,
	isLineShape,
	restyleShape,
	type ShapeEdit,
	type ShapeKind,
	type ShapePlacement,
	type ShapeStyle,
} from "../layers/shape.ts";
import { erasesShape } from "../shapes.ts";
import { addStroke } from "../strokes.ts";

/**
 * A stroke in document space joins the selected drawing, or starts a new one
 * on top. An eraser also removes each shape it passes over, whole, in the
 * same edit; a shape is one mark, so it's never left in pieces.
 */
export function drawStroke(
	document: EditorDocument,
	selectedLayerId: string | null,
	stroke: Stroke,
): EditorDocument {
	if (stroke.points.length < 2) return document;
	const selected = findLayer(document, selectedLayerId);
	const target =
		selected?.type === "drawing" && !selected.locked ? selected : null;
	// A pen joins the selected drawing only when it composites the same way.
	// An eraser clears whichever drawing is selected.
	const joins =
		target !== null &&
		(stroke.type === "eraser" || strokeBlend(stroke) === layerBlend(target));
	const erased = new Set(
		stroke.type === "eraser"
			? document.layers
					.filter(
						(layer) =>
							layer.type === "shape" &&
							!layer.locked &&
							!layer.hidden &&
							erasesShape(layer, stroke.points, stroke.width),
					)
					.map((layer) => layer.id)
			: [],
	);
	if (joins || erased.size > 0) {
		return withLayers(
			document,
			document.layers
				.filter((layer) => !erased.has(layer.id))
				.map((layer) =>
					joins && layer === target ? addStroke(target, stroke) : layer,
				),
		);
	}
	if (stroke.type !== "pen") return document;
	return addLayerOnTop(document, createDrawingLayer(stroke));
}

/** On top. A box needs both sides. */
export function addShape(
	document: EditorDocument,
	shape: ShapeKind,
	placement: ShapePlacement,
	style: ShapeStyle,
): EditorDocument {
	const { width, height } = placement;
	if (width <= 0 || (height <= 0 && !isLineShape(shape))) return document;
	return addLayerOnTop(document, createShapeLayer(shape, placement, style));
}

export function setShapeStyle(
	document: EditorDocument,
	id: string,
	edit: ShapeEdit,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "shape") return document;
	return replaceLayer(document, target, restyleShape(target, edit));
}
