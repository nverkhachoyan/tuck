import {
	type Adjustments,
	adjustmentsEqual,
	isNeutral,
} from "./adjustments.ts";
import { drawingBox, recenterDrawing } from "./drawing.ts";
import {
	hitTestBox,
	type Point,
	type Rect,
	type Size,
	type Transform,
	toLayerSpace,
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
// `sticker` marks one added from the sticker sheet, which is only named
// differently: its file is copied into the project like a photo's.
// `adjustments` is left out while none are made. `mask`, when the subject
// has been cut out of the image, is a grayscale image file stretched over it:
// the image shows where the mask is white, and not where it's black. The
// image's own file is untouched, so the cut can be undone or taken back.
// `maskStrokes` refine the cut by hand, painted over the mask (or over the
// whole image, without one) in the image's own pixels, centered on its
// middle, before it's flipped: a pen shows the image, an eraser hides it.
// They're left out while there are none.
export type ImageLayer = LayerBase & {
	type: "image";
	uri: string;
	width: number;
	height: number;
	flipped: boolean;
	opaque: boolean;
	sticker?: boolean;
	adjustments?: Adjustments;
	mask?: string;
	maskStrokes?: MaskStroke[];
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

// A pen's tip, when it isn't a plain round one: a marker's flat, see-through
// ink, or a neon tube's glow. Named for how they look; `DrawingLayerView`
// draws each.
export const penTips = ["marker", "neon"] as const;
export type PenTip = (typeof penTips)[number];

/**
 * What a stroke draws with: a pen's color, or an eraser, which clears what
 * the drawing's earlier strokes drew. `width` is the line's thickness, glow
 * and all. A pen without a `tip` is a plain round one.
 */
export type Brush =
	| { type: "pen"; color: string; width: number; tip?: PenTip }
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
 * How a redaction hides what's under it: covered with a color, blurred, or
 * pixelated. `radius` is the blur's sigma, and `size` a pixel's side, in
 * document pixels, however the layer is scaled, so resizing one never
 * weakens it.
 */
export type RedactionEffect =
	| { type: "solid"; color: string }
	| { type: "blur"; radius: number }
	| { type: "pixelate"; size: number };

export function effectsEqual(
	left: RedactionEffect,
	right: RedactionEffect,
): boolean {
	switch (left.type) {
		case "solid":
			return right.type === "solid" && left.color === right.color;
		case "blur":
			return right.type === "blur" && left.radius === right.radius;
		case "pixelate":
			return right.type === "pixelate" && left.size === right.size;
	}
}

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

/** The geometry of a box redaction before it becomes a document layer. */
export type RedactionBoxPlacement = Pick<
	RedactionBox,
	"width" | "height" | "transform"
>;

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

// Outlines the draw tool drags out. Named for how they look; `ShapeLayerView`
// draws each.
export const shapeKinds = ["rectangle", "ellipse", "line", "arrow"] as const;
export type ShapeKind = (typeof shapeKinds)[number];
export type LineShapeKind = "line" | "arrow";

type ShapeBase = LayerBase & {
	type: "shape";
	color: string;
	// The outline's or the line's thickness, in the layer's own units.
	strokeWidth: number;
};

/**
 * A rectangle or an ellipse outlined inside a box `width` by `height`,
 * centered on its origin, so its outer edge is where it was dragged to.
 */
export type BoxShape = ShapeBase & {
	shape: Exclude<ShapeKind, LineShapeKind>;
	width: number;
	height: number;
};

/**
 * A line `length` long, centered on its origin along its x axis, which its
 * transform turns. An arrow points to its end along +x.
 */
export type LineShape = ShapeBase & { shape: LineShapeKind; length: number };

export type ShapeLayer = BoxShape | LineShape;

/** How a shape is drawn, apart from where and how big. */
export type ShapeStyle = Pick<ShapeLayer, "color" | "strokeWidth">;

/**
 * What restyling an existing shape can change. Its kind only changes to one
 * with the same geometry: a rectangle to an ellipse, or a line to an arrow.
 */
export type ShapeEdit = Partial<
	Pick<ShapeLayer, "shape" | "color" | "strokeWidth">
>;

/**
 * Where a new shape goes, in document space: its center, its angle, and its
 * box's size. A line's length is its width, and its height means nothing.
 */
export type ShapePlacement = {
	x: number;
	y: number;
	rotation: number;
	width: number;
	height: number;
};

export type Layer =
	| ImageLayer
	| TextLayer
	| DrawingLayer
	| RedactionLayer
	| ShapeLayer;

/**
 * A named collection of existing layers. Groups deliberately keep their
 * children in the document's flat paint order: that makes rendering, export,
 * and canvas hit testing just as cheap as an ungrouped document, while the
 * layers panel can present a large batch as one row.
 */
export type LayerGroup = {
	id: string;
	name: string;
	layerIds: string[];
};

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
	// Groups only organize layers; they never add a canvas compositing layer.
	groups?: LayerGroup[];
};

export const identityTransform: Transform = {
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

export function createLayerGroup(
	name: string,
	layerIds: readonly string[],
): LayerGroup {
	return { id: createLayerId("group"), name, layerIds: [...layerIds] };
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
		groups: [],
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
	return { width, height, background, layers: [], groups: [] };
}

/** Drops deleted layers and empty groups, preserving the document's groups. */
export function groupsForLayers(
	groups: readonly LayerGroup[] | undefined,
	layers: readonly Layer[],
): LayerGroup[] {
	const ids = new Set(layers.map((layer) => layer.id));
	return (groups ?? []).flatMap((group) => {
		const layerIds = group.layerIds.filter((id) => ids.has(id));
		return layerIds.length > 0 ? [{ ...group, layerIds }] : [];
	});
}

/** Places something of this size centered on a canvas of the same size. */
export function centeredTransform(width: number, height: number): Transform {
	return { ...identityTransform, x: width / 2, y: height / 2 };
}

/**
 * The whole of a document, where a new layer goes unless it's given the
 * part the editor shows.
 */
export function documentArea(document: EditorDocument): Rect {
	return { x: 0, y: 0, width: document.width, height: document.height };
}

// Centered on `area`, unscaled.
function areaTransform(area: Rect): Transform {
	return {
		...identityTransform,
		x: area.x + area.width / 2,
		y: area.y + area.height / 2,
	};
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
		first.adjustments !== undefined ||
		isCutOut(first) ||
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
		if (
			layer.type !== "image" ||
			layer.hidden ||
			!layer.opaque ||
			isCutOut(layer)
		) {
			return false;
		}
		const box = {
			halfWidth: layer.width / 2 + COVER_TOLERANCE,
			halfHeight: layer.height / 2 + COVER_TOLERANCE,
		};
		return corners.every((corner) => hitTestBox(layer.transform, box, corner));
	});
}

/**
 * A new text layer's font size, relative to the shorter side of the area
 * it's placed in (the photo, or the part of it in view), so text starts out
 * looking the same on a 1080px screenshot and a 4000px camera photo. It's
 * fixed from then on: the layer's scale resizes it.
 */
export function initialFontSize(area: Size): number {
	return Math.max(1, Math.round(Math.min(area.width, area.height) * 0.08));
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
	style: Partial<TextLayerStyle> = {},
	area: Rect = documentArea(document),
): TextLayer {
	return {
		type: "text",
		id: createLayerId("text"),
		text,
		fontSize: initialFontSize(area),
		...defaultTextStyle,
		...style,
		// Meme captions span most of the photo before wrapping.
		maxWidth: area.width * 0.9,
		transform: areaTransform(area),
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
 * A photo as a new layer, centered and shrunk to sit well inside `area` (the
 * canvas, or the part of it in view), but never enlarged past its own
 * pixels, which would blur it. It starts unlocked, so it moves on the canvas
 * and the crop tool doesn't frame it.
 */
export function createImageLayer(
	document: EditorDocument,
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
	area: Rect = documentArea(document),
): ImageLayer {
	const scale = Math.min(
		1,
		(area.width * NEW_IMAGE_FIT) / width,
		(area.height * NEW_IMAGE_FIT) / height,
	);
	return {
		type: "image",
		id: createLayerId("image"),
		uri,
		width,
		height,
		flipped: false,
		opaque,
		transform: { ...areaTransform(area), scaleX: scale, scaleY: scale },
		hidden: false,
		locked: false,
	};
}

// How much of the canvas's shorter side a new sticker spans.
const NEW_STICKER_FIT = 0.3;

/**
 * A sticker's image as a new layer, centered on `area` (the canvas, or the
 * part of it in view) and sized to it rather than its pixels, so it looks
 * the same on a screenshot as on a large photo.
 */
export function createStickerLayer(
	document: EditorDocument,
	uri: string,
	width: number,
	height: number,
	opaque: boolean,
	area: Rect = documentArea(document),
): ImageLayer {
	const scale =
		(Math.min(area.width, area.height) * NEW_STICKER_FIT) /
		Math.max(width, height);
	return {
		...createImageLayer(document, uri, width, height, opaque),
		sticker: true,
		transform: { ...areaTransform(area), scaleX: scale, scaleY: scale },
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
	return createPlacedRedactionBox(
		{
			width: rect.width,
			height: rect.height,
			transform: {
				...identityTransform,
				x: rect.x + rect.width / 2,
				y: rect.y + rect.height / 2,
			},
		},
		effect,
	);
}

/** A box redaction with its complete oriented placement. */
export function createPlacedRedactionBox(
	placement: RedactionBoxPlacement,
	effect: RedactionEffect,
): RedactionBox {
	return {
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "box",
		...placement,
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

/** Whether a shape of this kind is a line, rather than a box. */
export function isLineShape(shape: ShapeKind): shape is LineShapeKind {
	"worklet";
	return shape === "line" || shape === "arrow";
}

export function isLine(layer: ShapeLayer): layer is LineShape {
	"worklet";
	return isLineShape(layer.shape);
}

export function createShapeLayer(
	shape: ShapeKind,
	placement: ShapePlacement,
	style: ShapeStyle,
): ShapeLayer {
	const { x, y, rotation, width, height } = placement;
	const base = {
		type: "shape",
		id: createLayerId("shape"),
		...style,
		transform: { ...identityTransform, x, y, rotation },
		hidden: false,
		locked: false,
	} as const;
	return isLineShape(shape)
		? { ...base, shape, length: width }
		: { ...base, shape, width, height };
}

/**
 * `layer` restyled by `edit`, or `layer` itself when nothing would change.
 * A kind with other geometry than the layer's is ignored (see `ShapeEdit`).
 */
export function restyleShape(layer: ShapeLayer, edit: ShapeEdit): ShapeLayer {
	const { shape = layer.shape, color = layer.color } = edit;
	const strokeWidth = edit.strokeWidth ?? layer.strokeWidth;
	const kind = isLineShape(shape) === isLine(layer) ? shape : layer.shape;
	if (
		kind === layer.shape &&
		color === layer.color &&
		strokeWidth === layer.strokeWidth
	) {
		return layer;
	}
	return { ...layer, shape: kind, color, strokeWidth } as ShapeLayer;
}

/**
 * `layer` with `adjustments`, left out when they change nothing, or `layer`
 * itself when its adjustments are the same already.
 */
export function withAdjustments(
	layer: ImageLayer,
	adjustments: Adjustments,
): ImageLayer {
	const current = layer.adjustments;
	if (isNeutral(adjustments)) {
		if (!current) return layer;
		const { adjustments: _, ...rest } = layer;
		return rest;
	}
	return current && adjustmentsEqual(current, adjustments)
		? layer
		: { ...layer, adjustments };
}

/** Whether some of `layer` is cut away: by a mask, or by hand. */
export function isCutOut(layer: ImageLayer): boolean {
	return layer.mask !== undefined || layer.maskStrokes !== undefined;
}

/**
 * `layer` shown through `mask` (see `ImageLayer`), or whole again when it's
 * null, or `layer` itself when that's how it's shown already. Strokes that
 * refined the cut before go with it, since they were painted against the
 * old one, unless `keepStrokes`: a mask grown or shrunk from the old one
 * (by a subject added to it or taken out) keeps them.
 */
export function withMask(
	layer: ImageLayer,
	mask: string | null,
	{ keepStrokes = false } = {},
): ImageLayer {
	const strokes = keepStrokes ? layer.maskStrokes : undefined;
	if ((layer.mask ?? null) === mask && layer.maskStrokes === strokes) {
		return layer;
	}
	const { mask: _, maskStrokes: __, ...rest } = layer;
	const shown = mask === null ? rest : { ...rest, mask };
	return strokes ? { ...shown, maskStrokes: strokes } : shown;
}

/**
 * `layer` with a stroke painted in document space added to its cut, taken
 * into the image's own pixels, however the layer has been moved, scaled,
 * turned, or flipped since. Its width scales with the layer's average
 * scale: a stretched image stretches the brush too.
 */
export function addMaskStroke(
	layer: ImageLayer,
	stroke: MaskStroke,
): ImageLayer {
	const { transform } = layer;
	const points: number[] = [];
	for (let i = 0; i < stroke.points.length; i += 2) {
		const local = toLayerSpace(transform, {
			x: stroke.points[i],
			y: stroke.points[i + 1],
		});
		points.push(roundPixel(layer.flipped ? -local.x : local.x));
		points.push(roundPixel(local.y));
	}
	const scale = Math.sqrt(Math.abs(transform.scaleX * transform.scaleY));
	return {
		...layer,
		maskStrokes: [
			...(layer.maskStrokes ?? []),
			{ type: stroke.type, width: roundPixel(stroke.width / scale), points },
		],
	};
}

/**
 * Where a point in document space falls on `layer`'s image, as fractions of
 * its width and height from its top left, however the layer is placed or
 * flipped, or null when it's off the image.
 */
export function imagePointAt(
	layer: ImageLayer,
	point: Point,
): { x: number; y: number } | null {
	const local = toLayerSpace(layer.transform, point);
	const x = (layer.flipped ? -local.x : local.x) / layer.width + 0.5;
	const y = local.y / layer.height + 0.5;
	return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

// Finer than a hundredth of a pixel is invisible, and would only make saved
// projects bigger. Adding 0 turns a flipped -0 into 0.
const roundPixel = (value: number) => Math.round(value * 100) / 100 + 0;

/**
 * A layer with a box its handles resize, resized to `width` by `height` with
 * its center (and, for a line, its angle) moved to `transform`: a
 * redaction's box, or a shape, whose length as a line is `width`. Null when
 * it has no such box, or nothing would change.
 */
export function resizeLayerBox(
	layer: Layer,
	transform: Transform,
	width: number,
	height: number,
): Layer | null {
	if (width <= 0 || height <= 0) return null;
	const moved = !transformsEqual(layer.transform, transform);
	if (layer.type === "shape" && isLine(layer)) {
		return moved || layer.length !== width
			? { ...layer, transform, length: width }
			: null;
	}
	if (
		layer.type === "shape" ||
		(layer.type === "redaction" && layer.shape === "box")
	) {
		return moved || layer.width !== width || layer.height !== height
			? { ...layer, transform, width, height }
			: null;
	}
	return null;
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
// box, a tenth of a line shape's length, or a tenth of a drawing's longer
// side (a line drawn straight has no shorter one).
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
		case "shape":
			return isLine(layer)
				? layer.length * 0.1
				: Math.min(layer.width, layer.height) * 0.1;
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
