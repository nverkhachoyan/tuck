/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	placeSelectionBar,
	selectionScreenBounds,
} from "../selectionBarPlacement.ts";

const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

describe("selectionScreenBounds", () => {
	test("maps the box through the layer and the viewport", () => {
		const bounds = selectionScreenBounds(
			{ ...identity, x: 100, y: 50, scaleX: 2 },
			{ halfWidth: 10, halfHeight: 5 },
			{ scale: 0.5, offsetX: 20, offsetY: 30 },
		);
		assert.deepEqual(bounds, { x: 60, y: 52.5, width: 20, height: 5 });
	});

	test("takes in a rotated box's corners", () => {
		const bounds = selectionScreenBounds(
			{ ...identity, rotation: Math.PI / 2 },
			{ halfWidth: 20, halfHeight: 5 },
			{ scale: 1, offsetX: 0, offsetY: 0 },
		);
		assert.ok(Math.abs(bounds.width - 10) < 1e-9);
		assert.ok(Math.abs(bounds.height - 40) < 1e-9);
	});
});

describe("placeSelectionBar", () => {
	const bar = { width: 200, height: 50 };
	const area = { width: 390, height: 600 };
	const gaps = { above: 40, below: 12, margin: 8 };

	test("sits centered above the selection, clear of the knob", () => {
		const selection = { x: 145, y: 300, width: 100, height: 40 };
		assert.deepEqual(placeSelectionBar(selection, bar, area, gaps), {
			x: 95,
			y: 210,
		});
	});

	test("stays inside the view's sides", () => {
		const left = { x: 0, y: 300, width: 40, height: 40 };
		const right = { x: 370, y: 300, width: 40, height: 40 };
		assert.equal(placeSelectionBar(left, bar, area, gaps).x, 8);
		assert.equal(placeSelectionBar(right, bar, area, gaps).x, 182);
	});

	test("goes below a selection with no room above", () => {
		const selection = { x: 145, y: 60, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps).y, 112);
	});

	test("stays in the view when the selection is dragged past it", () => {
		const over = { x: 145, y: -200, width: 100, height: 40 };
		const under = { x: 145, y: 700, width: 100, height: 40 };
		assert.equal(placeSelectionBar(over, bar, area, gaps).y, 8);
		assert.equal(placeSelectionBar(under, bar, area, gaps).y, 542);
	});

	test("keeps to the top when neither side has room", () => {
		const selection = { x: 0, y: 20, width: 390, height: 560 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps).y, 8);
	});
});
