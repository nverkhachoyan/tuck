import { drawingBox, recenterDrawing } from "./drawing.ts";
import {
	hitTestBox,
	type Rect,
	type Transform,
	transformsEqual,
} from "./geometry.ts";

type LayerBase = {
	id: string;
	transform: Transform;
	// Left out of the editor, hit testing, and export.
	hidden: boolean;
	// Can't be selected, and so can't be moved, on the canvas.
	locked: boolean;
	// When true, selection sides and corners stretch this layer instead of
	// uniformly scaling it. Only images and text expose this in the UI.
	resizable?: boolean;
};

// transform.x/y is the image's center in document space. `flipped` mirrors
// it within its own space, which keeps its transform's scale positive.
// `opaque` is whether every pixel is: photos are, a PNG may not be.
export type ImageLayer = LayerBase & {
	type: "image";
	uri: string;
	width: number;
	height: number;
	flipped: boolean;
	opaque: boolean;
};

export type TextAlign = "left" | "center" | "right";

// Named for how they look; `layers/fonts.ts` maps each to its bundled font.
export const textFonts = [
	"classic",
	"modern",
	"serif",
	"marker",
	"typewriter",
] as const;
export type TextFont = (typeof textFonts)[number];

// transform.x/y is the center of the text block in document space. Lines wrap
// at `maxWidth` (in the layer's own, unscaled space), and `\n` breaks a line.
export type TextLayer = LayerBase & {
	type: "text";
	text: string;
	font: TextFont;
	fontSize: number;
	color: string;
	// null draws the text without an outline.
	outlineColor: string | null;
	// A filled box behind each line; null draws none.
	backgroundColor: string | null;
	align: TextAlign;
	maxWidth: number;
};

/**
 * What editing can change on an existing text layer. Its size is set once
 * at creation (`fontSize`); resizing it afterwards goes through its transform.
 */
export type TextLayerEdit = Partial<
	Pick<
		TextLayer,
		"text" | "align" | "font" | "color" | "outlineColor" | "backgroundColor"
	>
>;

/**
 * What a stroke draws with: a pen's color, or an eraser, which clears what
 * the drawing's earlier strokes drew. `width` is the line's thickness.
 */
export type Brush =
	| { type: "pen"; color: string; width: number }
	| { type: "eraser"; width: number };

// `points` is flattened x, y pairs, which keeps saved projects small.
export type Stroke = Brush & { points: number[] };

// Strokes are in the layer's own space, centered on what its pens drew (see
// `recenterDrawing`), so its transform places it like any other layer.
export type DrawingLayer = LayerBase & {
	type: "drawing";
	strokes: Stroke[];
};

/**
 * A redaction's stroke: a pen covers, and an eraser uncovers what the strokes
 * before it covered. It has no color: the redaction's effect is what shows.
 */
export type MaskStroke = {
	type: "pen" | "eraser";
	width: number;
	points: number[];
};

/**
 * How a redaction hides what's under it: covered with a color, or blurred.
 * `radius` is the blur's sigma in document pixels, however the layer is
 * scaled, so resizing a blur never weakens it.
 */
export type RedactionEffect =
	| { type: "solid"; color: string }
	| { type: "blur"; radius: number };

type RedactionBase = LayerBase & {
	type: "redaction";
	effect: RedactionEffect;
};

/** A redaction over a box `width` by `height`, centered on its origin. */
export type RedactionBox = RedactionBase & {
	shape: "box";
	width: number;
	height: number;
};

/**
 * A redaction over strokes painted across what to hide, in its own space
 * and centered like a drawing's (see `recenterDrawing`).
 */
export type RedactionStrokes = RedactionBase & {
	shape: "strokes";
	strokes: MaskStroke[];
};

/** Hides what's drawn under it, inside its box or strokes. */
export type RedactionLayer = RedactionBox | RedactionStrokes;

export type Layer = ImageLayer | TextLayer | DrawingLayer | RedactionLayer;

// The canvas is the document itself: its size is the exported image's, and
// layers outside it are cropped.
export type EditorDocument = {
	width: number;
	height: number;
	// Fills the canvas behind every layer; null leaves it transparent.
	background: string | null;
	// Bottom to top, and possibly none: a blank canvas starts empty, and any
	// layer can be deleted.
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

/**
 * A canvas the size of the photo, with the photo as its only layer. The
 * photo starts locked, so the crop tool places it, until it's unlocked to
 * move freely.
 */
export function createDocumentFromImage(
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
): EditorDocument {
	return {
		width,
		height,
		background: null,
		layers: [
			{
				type: "image",
				id: "photo",
				uri,
				width,
				height,
				flipped: false,
				opaque,
				transform: centeredTransform(width, height),
				hidden: false,
				locked: true,
			},
		],
	};
}

/** An empty canvas, filled with `background` (null for transparent). */
export function createBlankDocument(
	width: number,
	height: number,
	background: string | null,
): EditorDocument {
	return { width, height, background, layers: [] };
}

/** Places something of this size centered on a canvas of the same size. */
export function centeredTransform(width: number, height: number): Transform {
	return { ...identityTransform, x: width / 2, y: height / 2 };
}

/**
 * Whether the document is worth keeping as a project: it's neither an empty
 * canvas nor the untouched photo it was made from. Unlocking the photo isn't
 * an edit until it's moved.
 */
export function hasEdits(document: EditorDocument): boolean {
	const [first, ...rest] = document.layers;
	if (!first) return false;
	return (
		rest.length > 0 ||
		first.type !== "image" ||
		first.hidden ||
		document.background !== null ||
		document.width !== first.width ||
		document.height !== first.height ||
		first.flipped ||
		!transformsEqual(
			first.transform,
			centeredTransform(first.width, first.height),
		)
	);
}

// In an image's pixels: gaps this small between its edge and the canvas's
// are floating-point error, not transparency.
const COVER_TOLERANCE = 0.01;

/**
 * Whether any of the canvas would export transparent: it has no background
 * and no visible opaque image covers all of it. Images that only cover it
 * together count as transparent too, which costs a larger file, never a
 * wrong one. Such a document exports as PNG.
 */
export function hasTransparency(document: EditorDocument): boolean {
	if (document.background !== null) return false;
	const corners = [
		{ x: 0, y: 0 },
		{ x: document.width, y: 0 },
		{ x: document.width, y: document.height },
		{ x: 0, y: document.height },
	];
	return !document.layers.some((layer) => {
		if (layer.type !== "image" || layer.hidden || !layer.opaque) return false;
		const box = {
			halfWidth: layer.width / 2 + COVER_TOLERANCE,
			halfHeight: layer.height / 2 + COVER_TOLERANCE,
		};
		return corners.every((corner) => hitTestBox(layer.transform, box, corner));
	});
}

/**
 * A new text layer's font size, relative to the photo's shorter side so text
 * starts out looking the same on a 1080px screenshot and a 4000px camera
 * photo. It's fixed from then on: the layer's scale resizes it.
 */
export function initialFontSize(document: EditorDocument): number {
	return Math.round(Math.min(document.width, document.height) * 0.08);
}

/** How a text layer's text looks, apart from its size. */
export type TextLayerStyle = Pick<
	TextLayer,
	"font" | "color" | "outlineColor" | "backgroundColor" | "align"
>;

/** Classic meme text: white fill, black outline, no box, centered. */
export const defaultTextStyle = {
	font: "classic",
	color: "#FFFFFF",
	outlineColor: "#000000",
	backgroundColor: null,
	align: "center",
} as const satisfies TextLayerStyle;

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
		locked: false,
	};
}

// How much of the canvas a new image layer may take up, either way.
const NEW_IMAGE_FIT = 0.8;

// How far a new image layer can be enlarged past covering the canvas before
// it blurs.
const NEW_IMAGE_HEADROOM = 1.5;

/**
 * The longest a new image layer's shorter side is worth being, in pixels:
 * enough to cover the canvas turned either way, with `NEW_IMAGE_HEADROOM` to
 * spare. Past that, pixels only cost memory: the editor and export each hold
 * every image decoded in full.
 */
export function maxNewImageShortSide(document: EditorDocument): number {
	return Math.ceil(
		Math.max(document.width, document.height) * NEW_IMAGE_HEADROOM,
	);
}

/**
 * A photo as a new layer, centered and shrunk to sit well inside the canvas,
 * but never enlarged past its own pixels, which would blur it. It starts
 * unlocked, so it moves on the canvas and the crop tool doesn't frame it.
 */
export function createImageLayer(
	document: EditorDocument,
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
): ImageLayer {
	const scale = Math.min(
		1,
		(document.width * NEW_IMAGE_FIT) / width,
		(document.height * NEW_IMAGE_FIT) / height,
	);
	return {
		type: "image",
		id: createLayerId("image"),
		uri,
		width,
		height,
		flipped: false,
		opaque,
		transform: {
			...centeredTransform(document.width, document.height),
			scaleX: scale,
			scaleY: scale,
		},
		hidden: false,
		locked: false,
	};
}

/**
 * A drawing begun by a pen stroke in document space. An eraser can't start
 * one: there's nothing to erase yet.
 */
export function createDrawingLayer(
	stroke: Stroke & { type: "pen" },
): DrawingLayer {
	return recenterDrawing({
		type: "drawing",
		id: createLayerId("drawing"),
		strokes: [stroke],
		transform: identityTransform,
		hidden: false,
		locked: false,
	});
}

/** A redaction covering `rect`, a box in document space. */
export function createRedactionBox(
	rect: Rect,
	effect: RedactionEffect,
): RedactionBox {
	return {
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "box",
		width: rect.width,
		height: rect.height,
		transform: {
			...identityTransform,
			x: rect.x + rect.width / 2,
			y: rect.y + rect.height / 2,
		},
		hidden: false,
		locked: false,
	};
}

/** A redaction begun by a pen stroke in document space, like a drawing. */
export function createRedactionStrokes(
	stroke: MaskStroke & { type: "pen" },
	effect: RedactionEffect,
): RedactionStrokes {
	return recenterDrawing<RedactionStrokes>({
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "strokes",
		strokes: [stroke],
		transform: identityTransform,
		hidden: false,
		locked: false,
	});
}

/**
 * A copy of a layer with a new id, nudged down and right so it's visibly
 * separate from the original instead of hiding it.
 */
export function duplicateLayer<T extends Layer>(layer: T): T {
	const offset = duplicateOffset(layer) * layer.transform.scaleX;
	return {
		...layer,
		id: createLayerId(layer.type),
		transform: {
			...layer.transform,
			x: layer.transform.x + offset,
			y: layer.transform.y + offset,
		},
	};
}

// In the layer's own units: half a line of text, a tenth of an image or a
// box, or a tenth of a drawing's longer side (a line drawn straight has no
// shorter one).
function duplicateOffset(layer: Layer): number {
	switch (layer.type) {
		case "text":
			return layer.fontSize * 0.5;
		case "image":
			return Math.min(layer.width, layer.height) * 0.1;
		case "drawing":
			return strokesOffset(layer);
		case "redaction":
			return layer.shape === "box"
				? Math.min(layer.width, layer.height) * 0.1
				: strokesOffset(layer);
	}
}

function strokesOffset(layer: { strokes: MaskStroke[] }): number {
	const { halfWidth, halfHeight } = drawingBox(layer);
	return Math.max(halfWidth, halfHeight) * 0.2;
}

/**
 * `layers` with one layer moved to `toIndex`, clamped to the stack. Returns
 * `layers` itself when nothing would change.
 */
export function reorderLayer(
	layers: Layer[],
	id: string,
	toIndex: number,
): Layer[] {
	const from = layers.findIndex((layer) => layer.id === id);
	const to = Math.min(Math.max(toIndex, 0), layers.length - 1);
	if (from < 0 || from === to) return layers;
	const next = layers.filter((layer) => layer.id !== id);
	next.splice(to, 0, layers[from]);
	return next;
}
