import type { EditorDocument } from "./document.ts";
import {
	applyMatrix,
	invertMatrix,
	type Matrix,
	multiplyMatrices,
	normalizeAngle,
	type Transform,
	transformMatrix,
	transformsEqual,
} from "./geometry.ts";
import { centeredTransform } from "./layers/base.ts";
import type { ImageLayer } from "./layers/image.ts";
import type { Layer } from "./layers/layer.ts";

/**
 * Where the photo, or the anchor standing in for one, sits on the canvas, and
 * whether it's mirrored.
 */
export type PhotoPlacement = {
	transform: Transform;
	flipped: boolean;
};

/**
 * What the canvas is framed around: the lowest visible locked image, which
 * only the crop tool places, or with none, the canvas itself, standing in
 * for a photo its own size. The crop tool crops it, and every other layer
 * follows it. A document's own photo starts locked and added ones don't, so
 * photos added to a blank canvas follow the canvas.
 */
export type FramingAnchor = PhotoPlacement & {
	width: number;
	height: number;
	// null when the canvas stands in.
	layer: ImageLayer | null;
};

export function framingAnchor(document: EditorDocument): FramingAnchor {
	const layer = document.layers.find(
		(layer): layer is ImageLayer =>
			layer.type === "image" && layer.locked && !layer.hidden,
	);
	if (layer) {
		const { width, height, transform, flipped } = layer;
		return { layer, width, height, transform, flipped };
	}
	const { width, height } = document;
	return {
		layer: null,
		width,
		height,
		transform: centeredTransform(width, height),
		flipped: false,
	};
}

/**
 * The image a photo tool (Adjust, Cut out, or Find) works on: the selected
 * visible image, or else the photo the canvas is framed around, or else the
 * lowest visible image. Null with none.
 */
export function targetImageLayer(
	document: EditorDocument,
	selected: Layer | undefined,
): ImageLayer | null {
	if (selected?.type === "image" && !selected.hidden) return selected;
	return (
		framingAnchor(document).layer ??
		document.layers.find(
			(layer): layer is ImageLayer => layer.type === "image" && !layer.hidden,
		) ??
		null
	);
}

/** The visible image layer with `id`, or undefined if it's gone or hidden. */
export function visibleImageLayer(
	document: EditorDocument,
	id: string,
): ImageLayer | undefined {
	return document.layers.find(
		(layer): layer is ImageLayer =>
			layer.type === "image" && !layer.hidden && layer.id === id,
	);
}

/**
 * The canvas's size and fill, and the anchor's place on it: everything the
 * crop tool changes.
 */
export type Framing = PhotoPlacement & {
	width: number;
	height: number;
	background: string | null;
};

export function documentFraming(document: EditorDocument): Framing {
	const { transform, flipped } = framingAnchor(document);
	const { width, height, background } = document;
	return { width, height, background, transform, flipped };
}

export function framingsEqual(left: Framing, right: Framing): boolean {
	return (
		left.width === right.width &&
		left.height === right.height &&
		left.background === right.background &&
		left.flipped === right.flipped &&
		transformsEqual(left.transform, right.transform)
	);
}

// Mirrors the photo's own space left to right, as `flipped` does.
const MIRROR: Matrix = { a: -1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/**
 * A layer's transform after the photo moves from one placement to another,
 * keeping it over the same spot of the photo. It keeps its angle on the canvas
 * unless `turn` is set, when it turns with the photo instead. Either way a
 * mirrored photo never mirrors the layer: text stays readable.
 */
export function rebaseTransform(
	transform: Transform,
	from: PhotoPlacement,
	to: PhotoPlacement,
	turn: boolean,
): Transform {
	"worklet";
	const flip = from.flipped !== to.flipped;
	let map = invertMatrix(transformMatrix(from.transform));
	if (flip) map = multiplyMatrices(MIRROR, map);
	map = multiplyMatrices(transformMatrix(to.transform), map);
	const { x, y } = applyMatrix(map, transform);
	const scale = to.transform.scaleX / from.transform.scaleX;
	const turned = flip
		? to.transform.rotation + from.transform.rotation - transform.rotation
		: transform.rotation + to.transform.rotation - from.transform.rotation;
	return {
		x,
		y,
		scaleX: transform.scaleX * scale,
		scaleY: transform.scaleY * scale,
		rotation: turn ? normalizeAngle(turned) : transform.rotation,
	};
}

/**
 * Whether a layer turns with the photo when it's reframed. `turnLayers` is
 * the crop tool's choice, but a redaction always turns: upright over text
 * that turned, its corners would show what it hides.
 */
export function turnsWithPhoto(layer: Layer, turnLayers: boolean): boolean {
	return turnLayers || layer.type === "redaction";
}

/**
 * The document with a new framing. Every layer but the anchor follows it, as
 * `rebaseTransform` describes, turning along with it as `turnsWithPhoto`
 * says. If the anchor stays put, so does everything else, exactly.
 */
export function reframeDocument(
	document: EditorDocument,
	framing: Framing,
	turnLayers: boolean,
): EditorDocument {
	const anchor = framingAnchor(document);
	const { width, height, background, ...to } = framing;
	const moved =
		anchor.flipped !== to.flipped ||
		!transformsEqual(anchor.transform, to.transform);
	return {
		...document,
		width,
		height,
		background,
		layers: !moved
			? document.layers
			: document.layers.map((layer) =>
					layer === anchor.layer
						? { ...layer, ...to }
						: {
								...layer,
								transform: rebaseTransform(
									layer.transform,
									anchor,
									to,
									turnsWithPhoto(layer, turnLayers),
								),
							},
				),
	};
}
