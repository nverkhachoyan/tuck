import type { Transform } from "./geometry.ts";

type LayerBase = {
	id: string;
	transform: Transform;
	// Left out of the editor, hit testing, and export.
	hidden: boolean;
};

export type ImageLayer = LayerBase & {
	type: "image";
	uri: string;
	width: number;
	height: number;
};

export type TextAlign = "left" | "center" | "right";

// transform.x/y is the center of the text block in document space. Lines wrap
// at `maxWidth` (in the layer's own, unscaled space), and `\n` breaks a line.
export type TextLayer = LayerBase & {
	type: "text";
	text: string;
	fontSize: number;
	color: string;
	// null draws the text without an outline.
	outlineColor: string | null;
	align: TextAlign;
	maxWidth: number;
};

/**
 * What editing can change on an existing text layer. Its size is set once
 * at creation (`fontSize`); resizing it afterwards goes through its transform.
 */
export type TextLayerEdit = Partial<
	Pick<TextLayer, "text" | "align" | "color" | "outlineColor">
>;

// BlurLayer | DrawingLayer join this union in later stages.
export type Layer = ImageLayer | TextLayer;

export type EditorDocument = {
	width: number;
	height: number;
	// Bottom to top. The first is the photo the document was made from, pinned
	// at the bottom: it can't be moved, hidden, or deleted.
	layers: Layer[];
};

const identityTransform: Transform = {
	x: 0,
	y: 0,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
};

let nextLayerId = 0;

export function createLayerId(prefix: string): string {
	nextLayerId += 1;
	return `${prefix}-${Date.now().toString(36)}-${nextLayerId}`;
}

export function createDocumentFromImage(
	uri: string,
	width: number,
	height: number,
): EditorDocument {
	return {
		width,
		height,
		layers: [
			{
				type: "image",
				id: "background",
				uri,
				width,
				height,
				transform: identityTransform,
				hidden: false,
			},
		],
	};
}

/**
 * A new text layer's font size, relative to the photo's shorter side so text
 * starts out looking the same on a 1080px screenshot and a 4000px camera
 * photo. It's fixed from then on: the layer's scale resizes it.
 */
export function initialFontSize(document: EditorDocument): number {
	return Math.round(Math.min(document.width, document.height) * 0.08);
}

/** Classic meme text: white fill, black outline, centered. */
export const defaultTextStyle = {
	color: "#FFFFFF",
	outlineColor: "#000000",
	align: "center",
} as const satisfies Pick<TextLayer, "color" | "outlineColor" | "align">;

export function createTextLayer(
	document: EditorDocument,
	text: string,
	align: TextAlign,
): TextLayer {
	return {
		type: "text",
		id: createLayerId("text"),
		text,
		fontSize: initialFontSize(document),
		...defaultTextStyle,
		align,
		// Meme captions span most of the photo before wrapping.
		maxWidth: document.width * 0.9,
		transform: {
			...identityTransform,
			x: document.width / 2,
			y: document.height / 2,
		},
		hidden: false,
	};
}

/**
 * A copy of a text layer with a new id, nudged down and right by half a
 * line so it's visibly separate from the original instead of hiding it.
 */
export function duplicateTextLayer(layer: TextLayer): TextLayer {
	const offset = layer.fontSize * layer.transform.scaleX * 0.5;
	return {
		...layer,
		id: createLayerId("text"),
		transform: {
			...layer.transform,
			x: layer.transform.x + offset,
			y: layer.transform.y + offset,
		},
	};
}

/**
 * `layers` with one layer moved to `toIndex`, clamped to stay above the
 * pinned photo. Returns `layers` itself when nothing would change.
 */
export function reorderLayer(
	layers: Layer[],
	id: string,
	toIndex: number,
): Layer[] {
	const from = layers.findIndex((layer) => layer.id === id);
	const to = Math.min(Math.max(toIndex, 1), layers.length - 1);
	if (from < 1 || from === to) return layers;
	const next = layers.filter((layer) => layer.id !== id);
	next.splice(to, 0, layers[from]);
	return next;
}
