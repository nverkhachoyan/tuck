/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	type CropDragLimits,
	cropHandleAt,
	dragCrop,
	SNAP,
} from "../cropDrag.ts";
import { isBoxOnPhoto, resetCrop, straightenTo } from "../cropGeometry.ts";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
	assert.ok(
		Math.abs(actual - expected) < tolerance,
		`expected ${actual} to be ${expected}`,
	);

const photo = { width: 4000, height: 3000 };

const limits = (overrides: Partial<CropDragLimits> = {}): CropDragLimits => ({
	photo,
	angle: 0,
	ratio: null,
	minSize: 100,
	bounds: { x: -5000, y: -5000, width: 10000, height: 10000 },
	tolerance: 50,
	...overrides,
});

describe("dragCrop", () => {
	const whole = resetCrop(photo).box;

	test("moves one edge for a side, two for a corner", () => {
		const { box } = dragCrop(whole, "right", -500, 999, limits());
		assert.deepEqual(box, { ...whole, width: 3500 });
		const corner = dragCrop(whole, "top-left", 300, 200, limits()).box;
		assert.deepEqual(corner, { x: -1700, y: -1300, width: 3700, height: 2800 });
	});

	test("snaps an edge onto the photo's, and past it expands the canvas", () => {
		const cropped = { ...whole, width: 3000 };
		const snapped = dragCrop(cropped, "right", 980, 0, limits());
		assert.equal(snapped.box.width, 4000);
		assert.equal(snapped.snapped, SNAP.right);
		const expanded = dragCrop(cropped, "right", 1300, 0, limits());
		assert.equal(expanded.box.width, 4300);
		assert.equal(expanded.snapped, 0);
	});

	test("snaps onto a straightened photo's edge where both corners fit", () => {
		const angle = 0.1;
		const inside = straightenTo(resetCrop(photo), angle, photo).box;
		const { box, snapped } = dragCrop(
			{ ...inside, width: inside.width - 30 },
			"right",
			40,
			0,
			limits({ angle }),
		);
		assert.equal(snapped, SNAP.right);
		assert.ok(isBoxOnPhoto(box, photo, angle));
		near(box.width, inside.width, 1e-6);
	});

	test("keeps a minimum size, and stays in bounds", () => {
		const shrunk = dragCrop(whole, "right", -9000, 0, limits()).box;
		assert.equal(shrunk.width, 100);
		const bounds = { x: -2500, y: -2000, width: 5000, height: 4000 };
		const grown = dragCrop(whole, "right", 9000, 0, limits({ bounds })).box;
		assert.equal(grown.x + grown.width, 2500);
	});

	test("moving snaps the box's edges or center onto the photo's", () => {
		const small = { x: -500, y: -400, width: 1000, height: 800 };
		const centered = dragCrop(small, "move", 30, -20, limits());
		assert.equal(centered.box.x, -500);
		assert.equal(centered.box.y, -400);
		assert.equal(centered.snapped, SNAP.centerX | SNAP.centerY);
		const edge = dragCrop(small, "move", 1480, 0, limits()).box;
		assert.equal(edge.x + edge.width, 2000);
	});

	test("a locked ratio scales from the opposite corner", () => {
		const square = { x: -1000, y: -1000, width: 2000, height: 2000 };
		const { box } = dragCrop(
			square,
			"bottom-right",
			300,
			100,
			limits({ ratio: 1, tolerance: 0 }),
		);
		assert.equal(box.x, -1000);
		assert.equal(box.y, -1000);
		assert.equal(box.width, box.height);
		assert.equal(box.width, 2200);
	});

	test("a locked ratio's side grows both ways about the middle", () => {
		const square = { x: -1000, y: -1000, width: 2000, height: 2000 };
		const { box } = dragCrop(
			square,
			"right",
			200,
			0,
			limits({ ratio: 1, tolerance: 0 }),
		);
		assert.deepEqual(box, { x: -1000, y: -1100, width: 2200, height: 2200 });
	});

	test("a locked ratio snaps whichever moving edge reaches the photo's", () => {
		const square = { x: -1500, y: -1500, width: 3000, height: 3000 };
		const { box, snapped } = dragCrop(
			square,
			"bottom-right",
			470,
			470,
			limits({ ratio: 1 }),
		);
		assert.equal(snapped, SNAP.right);
		assert.equal(box.x + box.width, 2000);
		assert.equal(box.width, box.height);
	});
});

describe("cropHandleAt", () => {
	const edges = { left: 100, top: 100, right: 300, bottom: 400 };

	test("finds corners, sides, and the middle", () => {
		assert.equal(cropHandleAt(edges, { x: 95, y: 98 }, 20), "top-left");
		assert.equal(cropHandleAt(edges, { x: 310, y: 250 }, 20), "right");
		assert.equal(cropHandleAt(edges, { x: 200, y: 405 }, 20), "bottom");
		assert.equal(cropHandleAt(edges, { x: 200, y: 250 }, 20), "move");
		assert.equal(cropHandleAt(edges, { x: 50, y: 250 }, 20), null);
	});

	test("leaves a small box's middle for moving it", () => {
		const small = { left: 100, top: 100, right: 140, bottom: 140 };
		assert.equal(cropHandleAt(small, { x: 120, y: 120 }, 22), "move");
		assert.equal(cropHandleAt(small, { x: 90, y: 120 }, 22), "left");
	});
});
