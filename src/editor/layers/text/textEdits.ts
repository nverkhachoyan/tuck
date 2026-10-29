import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
	replaceLayer,
} from "../../document/document.ts";
import type { Rect } from "../../document/geometry.ts";
import {
	createTextLayer,
	type TextLayerEdit,
	type TextLayerStyle,
} from "./text.ts";

/** On top, placed by `createTextLayer`. */
export function addTextLayer(
	document: EditorDocument,
	text: string,
	style?: Partial<TextLayerStyle>,
	area?: Rect,
): EditorDocument {
	return addLayerOnTop(document, createTextLayer(document, text, style, area));
}

export function updateTextLayer(
	document: EditorDocument,
	id: string,
	patch: TextLayerEdit,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "text") return document;
	const keys = Object.keys(patch) as (keyof TextLayerEdit)[];
	if (keys.every((key) => target[key] === patch[key])) return document;
	return replaceLayer(document, target, { ...target, ...patch });
}
