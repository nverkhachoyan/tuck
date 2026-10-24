import { isCutOut } from "./cutout.ts";
import { hitTestBox, transformsEqual } from "./geometry.ts";
import { centeredTransform, createLayerId } from "./layers/base.ts";
import type { Layer } from "./layers/layer.ts";

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
	groups?: LayerGroup[];
};

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

/** `document` with `layers`, its groups following them. */
export function withLayers(
	document: EditorDocument,
	layers: Layer[],
): EditorDocument {
	return {
		...document,
		layers,
		groups: groupsForLayers(document.groups, layers),
	};
}

export function findLayer(
	document: EditorDocument,
	id: string | null,
): Layer | undefined {
	return document.layers.find((layer) => layer.id === id);
}

export function addLayerOnTop(
	document: EditorDocument,
	layer: Layer,
): EditorDocument {
	return withLayers(document, [...document.layers, layer]);
}

/** Returns `document` itself when `next` is `target`, unchanged. */
export function replaceLayer(
	document: EditorDocument,
	target: Layer,
	next: Layer,
): EditorDocument {
	if (next === target) return document;
	return withLayers(
		document,
		document.layers.map((layer) => (layer === target ? next : layer)),
	);
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
