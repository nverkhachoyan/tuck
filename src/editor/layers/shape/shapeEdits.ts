import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
	replaceLayer,
} from "../../document/document.ts";
import {
	createShapeLayer,
	isLineShape,
	restyleShape,
	type ShapeEdit,
	type ShapeKind,
	type ShapePlacement,
	type ShapeStyle,
} from "./shape.ts";

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
