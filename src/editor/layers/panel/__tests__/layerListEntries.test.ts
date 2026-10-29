/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LayerGroup } from "../../../../model/document.ts";
import type { Layer } from "../../../../model/layers/layer.ts";
import { createTextLayer } from "../../../../model/layers/text.ts";
import { layerListEntries } from "../layerListEntries.ts";

// Bottom first, as the document holds them.
const layers: Layer[] = ["a", "b", "c", "d"].map((id) => ({
	...createTextLayer({ width: 100, height: 100 }, id),
	id,
}));

const group = (id: string, layerIds: string[]): LayerGroup => ({
	id,
	name: id,
	layerIds,
});

// Each row as a layer's id, or a group's id with its layers' ids.
const rows = (groups: LayerGroup[]) =>
	layerListEntries(layers, groups).map((entry) =>
		entry.type === "layer"
			? entry.layer.id
			: [entry.group.id, entry.layers.map((layer) => layer.id)],
	);

describe("layerListEntries", () => {
	test("lists the layers top first without groups", () => {
		assert.deepEqual(rows([]), ["d", "c", "b", "a"]);
	});

	test("shows a group once, where its top layer is", () => {
		assert.deepEqual(rows([group("g", ["a", "c"])]), [
			"d",
			["g", ["c", "a"]],
			"b",
		]);
	});

	test("leaves out a layer the document no longer has", () => {
		assert.deepEqual(rows([group("g", ["b", "gone"])]), [
			"d",
			"c",
			["g", ["b"]],
			"a",
		]);
		assert.deepEqual(rows([group("empty", ["gone"])]), ["d", "c", "b", "a"]);
	});
});
