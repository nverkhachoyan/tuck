export type Transform = {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
};

export type ImageLayer = {
	type: "image";
	id: string;
	uri: string;
	width: number;
	height: number;
	transform: Transform;
};

// transform.x/y is the text's center point in document space.
export type TextLayer = {
	type: "text";
	id: string;
	text: string;
	fontSize: number;
	color: string;
	outlineColor: string;
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

export function createTextLayer(centerX: number, centerY: number): TextLayer {
	return {
		type: "text",
		id: createLayerId("text"),
		text: "TEXT",
		fontSize: 64,
		color: "white",
		outlineColor: "black",
		transform: { ...identityTransform, x: centerX, y: centerY },
	};
}
