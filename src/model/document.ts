import type { Transform } from "./geometry.ts";

export type ImageLayer = {
	type: "image";
	id: string;
	uri: string;
	width: number;
	height: number;
	transform: Transform;
};

export type TextAlign = "left" | "center" | "right";

// transform.x/y is the center of the text block in document space. Lines wrap
// at `maxWidth` (in the layer's own, unscaled space), and `\n` breaks a line.
export type TextLayer = {
	type: "text";
	id: string;
	text: string;
	fontSize: number;
	color: string;
	// null draws the text without an outline.
	outlineColor: string | null;
	align: TextAlign;
	maxWidth: number;
	transform: Transform;
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
