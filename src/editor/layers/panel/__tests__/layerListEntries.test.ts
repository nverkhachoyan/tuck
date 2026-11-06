/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LayerGroup } from "../../../document/document.ts";
import { swatchName } from "../../../shell/swatches.ts";
import {
	createDrawingLayer,
	type DrawingLayer,
	type Stroke,
} from "../../drawing/drawing.ts";
import type { Layer } from "../../layer.ts";
import { createTextLayer } from "../../text/text.ts";
import { layerListEntries, markName } from "../layerListEntries.ts";

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

describe("markName", () => {
	const mark = (...strokes: Stroke[]): DrawingLayer => ({
		...createDrawingLayer(strokes[0] as Stroke & { type: "pen" }),
		strokes,
	});
	const pen = (
		color: string,
		tip?: "marker" | "ink" | "neon",
	): Stroke & { type: "pen" } =>
		tip
			? { type: "pen", color, width: 4, points: [0, 0, 10, 0], tip }
			: { type: "pen", color, width: 4, points: [0, 0, 10, 0] };

	test("names the kind after the swatch's color", () => {
		assert.equal(markName(mark(pen("#FF3B30"))), "Red pen");
		assert.equal(markName(mark(pen("#ffd60a", "marker"))), "Yellow highlight");
		assert.equal(markName(mark(pen("#0A84FF", "ink"))), "Blue marker");
		assert.equal(markName(mark(pen("#34C759", "neon"))), "Green neon");
	});

	test("a color that isn't a swatch leaves the kind alone", () => {
		assert.equal(markName(mark(pen("#123456"))), "Pen");
		assert.equal(markName(mark(pen("#123456", "marker"))), "Highlight");
	});

	test("strokes that differ in tip or color, or none, are a Drawing", () => {
		assert.equal(markName(mark(pen("#FF3B30"), pen("#0A84FF"))), "Drawing");
		assert.equal(
			markName(mark(pen("#FF3B30"), pen("#FF3B30", "neon"))),
			"Drawing",
		);
		assert.equal(
			markName({
				...mark(pen("#FF3B30")),
				strokes: [{ type: "eraser", width: 4, points: [0, 0] }],
			}),
			"Drawing",
		);
		assert.equal(
			markName(
				mark(pen("#FF3B30"), { type: "eraser", width: 4, points: [0, 0] }),
			),
			"Red pen",
		);
	});
});

describe("swatchName", () => {
	test("names a swatch whatever its case, and nothing else", () => {
		assert.equal(swatchName("#0a84ff"), "Blue");
		assert.equal(swatchName("#0A84FE"), null);
	});
});
