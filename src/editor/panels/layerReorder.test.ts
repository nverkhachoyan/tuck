/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dragRow, layerIndexForSlot, moveItem } from "./layerReorder.ts";

describe("moveItem", () => {
	test("moves an item down or up, leaving the input alone", () => {
		const items = ["a", "b", "c", "d"];
		assert.deepEqual(moveItem(items, 0, 2), ["b", "c", "a", "d"]);
		assert.deepEqual(moveItem(items, 3, 1), ["a", "d", "b", "c"]);
		assert.deepEqual(items, ["a", "b", "c", "d"]);
	});
});

describe("dragRow", () => {
	test("follows the drag and drops into the nearest slot", () => {
		assert.deepEqual(dragRow(1, 20, 50, 4), { top: 70, slot: 1 });
		assert.deepEqual(dragRow(1, 30, 50, 4), { top: 80, slot: 2 });
		assert.deepEqual(dragRow(2, -80, 50, 4), { top: 20, slot: 0 });
	});

	test("stays within the list", () => {
		assert.deepEqual(dragRow(0, -40, 50, 4), { top: 0, slot: 0 });
		assert.deepEqual(dragRow(2, 500, 50, 4), { top: 150, slot: 3 });
	});
});

describe("layerIndexForSlot", () => {
	test("maps the top row to the last layer and the bottom row to the first", () => {
		// Three layers: slots 0..2 are layers 2..0.
		assert.equal(layerIndexForSlot(0, 3), 2);
		assert.equal(layerIndexForSlot(2, 3), 0);
	});
});
