import {
	type EditorDocument,
	findLayer,
	replaceLayer,
	withLayers,
} from "../document/document.ts";
import {
	type GroupTransformChange,
	type Transform,
	transformAbout,
	transformsEqual,
} from "../document/geometry.ts";
import {
	duplicateLayer,
	type Layer,
	reorderLayer,
	resizeLayerBox,
} from "./layer.ts";

/** Where Arrange moves one or more layers in the stack. */
export type ArrangeMove = "front" | "forward" | "backward" | "back";

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

/** Removes every layer whose id is in `ids`. */
export function deleteLayers(
	document: EditorDocument,
	ids: readonly string[],
): EditorDocument {
	if (ids.length === 0) return document;
	const doomed = new Set(ids);
	const remaining = document.layers.filter((layer) => !doomed.has(layer.id));
	if (remaining.length === document.layers.length) return document;
	return withLayers(document, remaining);
}

/**
 * Duplicates each layer in `ids`, offset as `duplicateLayer` does, all on top
 * in their bottom-to-top document order. Returns the document itself when
 * nothing matches, and the new copies' ids for the store to select.
 */
export function duplicateLayers(
	document: EditorDocument,
	ids: readonly string[],
): { document: EditorDocument; copyIds: string[] } {
	if (ids.length === 0) return { document, copyIds: [] };
	const wanted = new Set(ids);
	const copies = document.layers
		.filter((layer) => wanted.has(layer.id))
		.map((layer) => duplicateLayer(layer));
	if (copies.length === 0) return { document, copyIds: [] };
	return {
		document: withLayers(document, [...document.layers, ...copies]),
		copyIds: copies.map((copy) => copy.id),
	};
}

/** Whether `arrangeLayers` would move any unlocked layer in `ids` in `direction`. */
export function canArrangeLayers(
	layers: readonly Layer[],
	ids: readonly string[],
	direction: "forward" | "backward",
): boolean {
	if (ids.length === 0) return false;
	const selected = new Set(ids);
	let seenSelected = false;
	let seenUnselected = false;
	for (const layer of layers) {
		if (layer.locked) continue;
		if (selected.has(layer.id)) {
			if (direction === "backward" && seenUnselected) return true;
			seenSelected = true;
		} else {
			if (direction === "forward" && seenSelected) return true;
			seenUnselected = true;
		}
	}
	return false;
}

/**
 * Moves the unlocked layers in `ids` forward, backward, to front, or to back
 * while keeping their relative order. Locked layers stay at their indices.
 */
export function arrangeLayers(
	document: EditorDocument,
	ids: readonly string[],
	move: ArrangeMove,
): EditorDocument {
	if (ids.length === 0) return document;
	const selected = new Set(ids);
	const unlocked = document.layers.filter((layer) => !layer.locked);
	if (!unlocked.some((layer) => selected.has(layer.id))) return document;

	let nextUnlocked: Layer[];
	if (move === "front") {
		nextUnlocked = [
			...unlocked.filter((layer) => !selected.has(layer.id)),
			...unlocked.filter((layer) => selected.has(layer.id)),
		];
	} else if (move === "back") {
		nextUnlocked = [
			...unlocked.filter((layer) => selected.has(layer.id)),
			...unlocked.filter((layer) => !selected.has(layer.id)),
		];
	} else if (move === "forward") {
		nextUnlocked = unlocked.slice();
		for (let i = nextUnlocked.length - 2; i >= 0; i--) {
			if (
				selected.has(nextUnlocked[i].id) &&
				!selected.has(nextUnlocked[i + 1].id)
			) {
				[nextUnlocked[i], nextUnlocked[i + 1]] = [
					nextUnlocked[i + 1],
					nextUnlocked[i],
				];
			}
		}
	} else {
		nextUnlocked = unlocked.slice();
		for (let i = 1; i < nextUnlocked.length; i++) {
			if (
				selected.has(nextUnlocked[i].id) &&
				!selected.has(nextUnlocked[i - 1].id)
			) {
				[nextUnlocked[i - 1], nextUnlocked[i]] = [
					nextUnlocked[i],
					nextUnlocked[i - 1],
				];
			}
		}
	}

	if (nextUnlocked.every((layer, index) => layer === unlocked[index])) {
		return document;
	}
	let cursor = 0;
	const nextLayers = document.layers.map((layer) =>
		layer.locked ? layer : nextUnlocked[cursor++],
	);
	return withLayers(document, nextLayers);
}

/** Moves every unlocked layer in `ids` by a document-space offset. */
export function nudgeLayers(
	document: EditorDocument,
	ids: readonly string[],
	dx: number,
	dy: number,
): EditorDocument {
	if (ids.length === 0 || (dx === 0 && dy === 0)) return document;
	const selected = new Set(ids);
	let changed = false;
	const nextLayers = document.layers.map((layer) => {
		if (layer.locked || !selected.has(layer.id)) return layer;
		changed = true;
		return {
			...layer,
			transform: {
				...layer.transform,
				x: layer.transform.x + dx,
				y: layer.transform.y + dy,
			},
		};
	});
	return changed ? withLayers(document, nextLayers) : document;
}

/** Applies a group transform change to every unlocked layer in `ids`. */
export function transformLayers(
	document: EditorDocument,
	ids: readonly string[],
	change: GroupTransformChange,
): EditorDocument {
	if (
		ids.length === 0 ||
		(change.dx === 0 &&
			change.dy === 0 &&
			change.scale === 1 &&
			change.rotation === 0)
	) {
		return document;
	}
	const selected = new Set(ids);
	let changed = false;
	const nextLayers = document.layers.map((layer) => {
		if (layer.locked || !selected.has(layer.id)) return layer;
		const transform = transformAbout(layer.transform, change);
		if (transformsEqual(layer.transform, transform)) return layer;
		changed = true;
		return { ...layer, transform };
	});
	return changed ? withLayers(document, nextLayers) : document;
}
