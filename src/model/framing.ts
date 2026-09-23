import { type EditorDocument, photoLayer } from "./document.ts";
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

/** Where the photo sits on the canvas, and whether it's mirrored. */
export type PhotoPlacement = {
	transform: Transform;
	flipped: boolean;
};

/**
 * The canvas's size and fill, and the photo's place on it: everything the
 * crop tool changes.
 */
export type Framing = PhotoPlacement & {
	width: number;
	height: number;
	background: string | null;
};

export function documentFraming(document: EditorDocument): Framing {
	const { transform, flipped } = photoLayer(document);
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
 * The document with a new framing. Every other layer follows the photo, as
 * `rebaseTransform` describes; `turnLayers` turns them along with it. If the
 * photo stays put, so does everything else, exactly.
 */
export function reframeDocument(
	document: EditorDocument,
	framing: Framing,
	turnLayers: boolean,
): EditorDocument {
	const photo = photoLayer(document);
	const { width, height, background, ...to } = framing;
	const moved =
		photo.flipped !== to.flipped ||
		!transformsEqual(photo.transform, to.transform);
	return {
		...document,
		width,
		height,
		background,
		layers: !moved
			? document.layers
			: document.layers.map((layer) =>
					layer === photo
						? { ...photo, ...to }
						: {
								...layer,
								transform: rebaseTransform(
									layer.transform,
									photo,
									to,
									turnLayers,
								),
							},
				),
	};
}
