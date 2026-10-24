import type { EditorDocument } from "../document.ts";
import {
	documentFraming,
	type Framing,
	framingsEqual,
	reframeDocument,
} from "../framing.ts";

export function reframe(
	document: EditorDocument,
	framing: Framing,
	turnLayers: boolean,
): EditorDocument {
	if (framingsEqual(documentFraming(document), framing)) return document;
	return reframeDocument(document, framing, turnLayers);
}

export function setBackground(
	document: EditorDocument,
	background: string | null,
): EditorDocument {
	if (document.background === background) return document;
	return { ...document, background };
}
