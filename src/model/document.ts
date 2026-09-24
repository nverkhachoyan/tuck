import { hitTestBox, type Transform, transformsEqual } from "./geometry.ts";

type LayerBase = {
	id: string;
	transform: Transform;
	// Left out of the editor, hit testing, and export.
	hidden: boolean;
	// Can't be selected, and so can't be moved, on the canvas.
	locked: boolean;
};

// transform.x/y is the image's center in document space. `flipped` mirrors
// it within its own space, which keeps its transform's scale positive.
export type ImageLayer = LayerBase & {
	type: "image";
	uri: string;
	width: number;
	height: number;
	flipped: boolean;
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

// BlurLayer | DrawingLayer join this union in later stages.
export type Layer = ImageLayer | TextLayer;

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
 * and no visible image covers all of it (picked photos are JPEGs, so opaque).
 * Images that only cover it together count as transparent too, which costs a
 * larger file, never a wrong one. Such a document exports as PNG.
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
		if (layer.type !== "image" || layer.hidden) return false;
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

// In the layer's own units: half a line of text, or a tenth of an image.
function duplicateOffset(layer: Layer): number {
	switch (layer.type) {
		case "text":
			return layer.fontSize * 0.5;
		case "image":
			return Math.min(layer.width, layer.height) * 0.1;
	}
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
