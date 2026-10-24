import type { Adjustments } from "../adjustments.ts";
import {
	type EditorDocument,
	findLayer,
	replaceLayer,
	withAdjustments,
} from "../document.ts";

export function setAdjustments(
	document: EditorDocument,
	id: string,
	adjustments: Adjustments,
): EditorDocument {
	const target = findLayer(document, id);
	if (target?.type !== "image") return document;
	return replaceLayer(document, target, withAdjustments(target, adjustments));
}
