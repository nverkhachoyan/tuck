import {
	type EditorDocument,
	findLayer,
	replaceLayer,
	withLayers,
} from "../document.ts";
import { type Transform, transformsEqual } from "../geometry.ts";
import { type Layer, reorderLayer, resizeLayerBox } from "../layers/layer.ts";

type LayerFlag = "hidden" | "locked";

// A locked layer can't be moved or resized.
function findUnlockedLayer(
	document: EditorDocument,
	id: string,
): Layer | undefined {
	const layer = findLayer(document, id);
	return layer?.locked ? undefined : layer;
}

export function setLayerFlag(
	document: EditorDocument,
	id: string,
	flag: LayerFlag,
	value: boolean,
): EditorDocument {
	const target = findLayer(document, id);
	if (!target || target[flag] === value) return document;
	return replaceLayer(document, target, { ...target, [flag]: value });
}

/** Sets `flag` on each of the group's layers. */
export function setLayerGroupFlag(
	document: EditorDocument,
	id: string,
	flag: LayerFlag,
	value: boolean,
): EditorDocument {
	const group = document.groups?.find((candidate) => candidate.id === id);
	if (!group) return document;
	const ids = new Set(group.layerIds);
	const changes = (layer: Layer) => ids.has(layer.id) && layer[flag] !== value;
	if (!document.layers.some(changes)) return document;
	return withLayers(
		document,
		document.layers.map((layer) =>
			changes(layer) ? { ...layer, [flag]: value } : layer,
		),
	);
}

export function deleteLayer(
	document: EditorDocument,
	id: string,
): EditorDocument {
	if (!findLayer(document, id)) return document;
	return withLayers(
		document,
		document.layers.filter((layer) => layer.id !== id),
	);
}

/** The group and every layer in it. */
export function deleteLayerGroup(
	document: EditorDocument,
	id: string,
): EditorDocument {
	const group = document.groups?.find((candidate) => candidate.id === id);
	if (!group) return document;
	const ids = new Set(group.layerIds);
	return {
		...document,
		layers: document.layers.filter((layer) => !ids.has(layer.id)),
		groups: (document.groups ?? []).filter((candidate) => candidate !== group),
	};
}

export function moveLayer(
	document: EditorDocument,
	id: string,
	toIndex: number,
): EditorDocument {
	const reordered = reorderLayer(document.layers, id, toIndex);
	if (reordered === document.layers) return document;
	return withLayers(document, reordered);
}

export function transformLayer(
	document: EditorDocument,
	id: string,
	transform: Transform,
): EditorDocument {
	const target = findUnlockedLayer(document, id);
	if (!target || transformsEqual(target.transform, transform)) return document;
	return replaceLayer(document, target, { ...target, transform });
}

/**
 * Like `transformLayer`, for a box resized by its handles, a redaction's or a
 * shape's: its size changes, and its center moves with the sides that did.
 * A line's length is `width`, and its ends turn it too.
 */
export function resizeBox(
	document: EditorDocument,
	id: string,
	transform: Transform,
	width: number,
	height: number,
): EditorDocument {
	const target = findUnlockedLayer(document, id);
	const resized = target && resizeLayerBox(target, transform, width, height);
	if (!target || !resized) return document;
	return replaceLayer(document, target, resized);
}

export function setLayerResizable(
	document: EditorDocument,
	id: string,
	resizable: boolean,
): EditorDocument {
	const target = findUnlockedLayer(document, id);
	if (
		(target?.type !== "image" && target?.type !== "text") ||
		target.resizable === resizable
	) {
		return document;
	}
	return replaceLayer(document, target, { ...target, resizable });
}

/** Moves a layer by a document-space offset. */
export function nudgeLayer(
	document: EditorDocument,
	id: string,
	dx: number,
	dy: number,
): EditorDocument {
	const target = findUnlockedLayer(document, id);
	if (!target || (dx === 0 && dy === 0)) return document;
	const { x, y } = target.transform;
	return replaceLayer(document, target, {
		...target,
		transform: { ...target.transform, x: x + dx, y: y + dy },
	});
}
