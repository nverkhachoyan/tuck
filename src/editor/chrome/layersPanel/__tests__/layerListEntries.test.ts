/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LayerGroup } from "../../../document/document.ts";
import {
	createDrawingLayer,
	type DrawingLayer,
	type Stroke,
} from "../../../layers/drawing/drawing.ts";
import type { Layer } from "../../../layers/layer.ts";
import { createTextLayer } from "../../../layers/text/text.ts";
import { swatchName } from "../../../shell/swatches.ts";
import { layerListEntries, markName, markTile } from "../layerListEntries.ts";

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

describe("markTile", () => {
	const night = ["#2A2B30", "#F3F3F1"];
	const day = ["#F2F3F5", "#000000"];
	const mark = (...colors: string[]): DrawingLayer => {
		const strokes: Stroke[] = colors.map((color) => ({
			type: "pen",
			color,
			width: 4,
			points: [0, 0, 10, 0],
		}));
		return {
			...createDrawingLayer(strokes[0] as Stroke & { type: "pen" }),
			strokes,
		};
	};

	test("keeps the usual tile for ink that shows on it", () => {
		assert.equal(markTile(mark("#FF3B30"), night), "#2A2B30");
		assert.equal(markTile(mark("#000000"), day), "#F2F3F5");
	});

	test("turns to the other tile for ink that would vanish", () => {
		assert.equal(markTile(mark("#000000"), night), "#F3F3F1");
		assert.equal(markTile(mark("#FFFFFF"), day), "#000000");
		assert.equal(markTile(mark("#FFD60A"), day), "#000000");
	});

	test("judges mixed ink by its faintest color", () => {
		// Red shows on both; black only on the light tile.
		assert.equal(markTile(mark("#FF3B30", "#000000"), night), "#F3F3F1");
	});

	test("keeps the first tile when there's no pen", () => {
		const erased: DrawingLayer = {
			...mark("#000000"),
			strokes: [{ type: "eraser", width: 4, points: [0, 0, 10, 0] }],
		};
		assert.equal(markTile(erased, night), "#2A2B30");
	});
});
