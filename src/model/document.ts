import type { Transform } from "./geometry";

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
	outlineColor: string;
	align: TextAlign;
	maxWidth: number;
	transform: Transform;
};

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
 * Font sizing is relative to the photo's shorter side so text looks the same
 * on a 1080px screenshot and a 4000px camera photo.
 */
export type FontSizeRange = {
	min: number;
	max: number;
	step: number;
	initial: number;
};

export function getFontSizeRange(document: EditorDocument): FontSizeRange {
	const base = Math.min(document.width, document.height);
	return {
		min: Math.round(base * 0.02),
		max: Math.round(base * 0.4),
		step: Math.round(base * 0.015),
		initial: Math.round(base * 0.08),
	};
}

/** Classic meme text: white fill, black outline, centered. */
export const defaultTextStyle = {
	color: "white",
	outlineColor: "black",
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
		fontSize: getFontSizeRange(document).initial,
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
