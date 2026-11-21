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
	// No photo, so every spot covers as little, and the order decides.
	const none = { x: 0, y: 0, width: 0, height: 0 };

	test("sits centered above the selection, clear of the knob", () => {
		const selection = { x: 145, y: 300, width: 100, height: 40 };
		assert.deepEqual(placeSelectionBar(selection, bar, area, gaps, none), {
			x: 95,
			y: 210,
		});
	});

	test("stays inside the view's sides", () => {
		const left = { x: 0, y: 300, width: 40, height: 40 };
		const right = { x: 370, y: 300, width: 40, height: 40 };
		assert.equal(placeSelectionBar(left, bar, area, gaps, none).x, 8);
		assert.equal(placeSelectionBar(right, bar, area, gaps, none).x, 182);
	});

	test("goes below a selection with no room above", () => {
		const selection = { x: 145, y: 60, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, none).y, 112);
	});

	test("stays in the view when the selection is dragged past it", () => {
		const over = { x: 145, y: -200, width: 100, height: 40 };
		const under = { x: 145, y: 700, width: 100, height: 40 };
		assert.equal(placeSelectionBar(over, bar, area, gaps, none).y, 8);
		assert.equal(placeSelectionBar(under, bar, area, gaps, none).y, 542);
	});

	test("keeps to the top when neither side has room", () => {
		const selection = { x: 0, y: 20, width: 390, height: 560 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, none).y, 8);
	});

	test("goes below when less of the photo is under it there", () => {
		// The photo ends just under the bar below the selection, with no
		// room for the bar on the table past it.
		const photo = { x: 0, y: 100, width: 390, height: 440 };
		const selection = { x: 145, y: 470, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, photo).y, 522);
	});

	test("moves out to the table past a photo's edge", () => {
		// A wide photo on a phone leaves the table above and below it.
		const photo = { x: 0, y: 150, width: 390, height: 300 };
		const selection = { x: 145, y: 200, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, photo).y, 88);
	});

	test("takes the nearer table when both are clear", () => {
		const photo = { x: 0, y: 150, width: 390, height: 300 };
		const selection = { x: 145, y: 350, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, photo).y, 462);
	});

	test("keeps above when the photo fills the view either way", () => {
		const photo = { x: 0, y: 0, width: 390, height: 600 };
		const selection = { x: 145, y: 300, width: 100, height: 40 };
		assert.equal(placeSelectionBar(selection, bar, area, gaps, photo).y, 210);
	});
});
