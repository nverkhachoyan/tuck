/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Transform } from "../../../model/geometry.ts";
import {
	CORNERS,
	type Handle,
	handleAt,
	handlePosition,
	resizeByDrag,
	resizeLockedByDrag,
	rotateByDrag,
	scaleByDrag,
} from "../handleGeometry.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be ${expected}`,
	);

describe("handlePosition", () => {
	const box = { halfWidth: 50, halfHeight: 10 };

	test("puts the corners on the scaled box and the knob above it", () => {
		const transform: Transform = {
			x: 100,
			y: 100,
			scaleX: 2,
			scaleY: 2,
			rotation: 0,
		};
		const at = (handle: Parameters<typeof handlePosition>[2]) =>
			handlePosition(transform, box, handle, 30);
		near(at("top-left").x, 0);
		near(at("top-left").y, 80);
		near(at("bottom-right").x, 200);
		near(at("bottom-right").y, 120);
		near(at("right").x, 200);
		near(at("right").y, 100);
		// 30 units above the top edge, unaffected by the layer's scale.
		near(at("rotate").x, 100);
		near(at("rotate").y, 50);
	});

	test("rotates the knob with the layer", () => {
		const quarterTurn: Transform = {
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			rotation: Math.PI / 2,
		};
		// A quarter turn clockwise points the layer's "up" to the right.
		const rotate = handlePosition(quarterTurn, box, "rotate", 30);
		near(rotate.x, 40);
		near(rotate.y, 0);
	});
});

describe("handleAt", () => {
	const transform: Transform = {
		x: 0,
		y: 0,
		scaleX: 1,
		scaleY: 1,
		rotation: 0,
	};
	const box = { halfWidth: 50, halfHeight: 10 };

	const all: Handle[] = [...CORNERS, "top", "right", "bottom", "left"];

	test("finds the handle within the radius, or none", () => {
		assert.equal(
			handleAt(transform, box, { x: 52, y: 12 }, 5, 30, [...all, "rotate"]),
			"bottom-right",
		);
		assert.equal(
			handleAt(transform, box, { x: 0, y: -40 }, 5, 30, [...all, "rotate"]),
			"rotate",
		);
		assert.equal(handleAt(transform, box, { x: 0, y: 0 }, 5, 30, all), null);
	});

	test("only finds the handles it's given", () => {
		const onRightSide = { x: 51, y: 1 };
		assert.equal(handleAt(transform, box, onRightSide, 5, 30, all), "right");
		assert.equal(handleAt(transform, box, onRightSide, 5, 30, CORNERS), null);
	});

	test("picks the nearest when handles overlap", () => {
		const tiny = { halfWidth: 2, halfHeight: 2 };
		assert.equal(
			handleAt(transform, tiny, { x: 3, y: 3 }, 10, 30, all),
			"bottom-right",
		);
	});
});

describe("scaleByDrag", () => {
	test("scales with the pointer's distance from the center", () => {
		const center = { x: 0, y: 0 };
		near(scaleByDrag(center, { x: 10, y: 0 }, { x: 0, y: 30 }, 2), 6);
	});

	test("keeps the scale when the drag starts on the center", () => {
		const center = { x: 5, y: 5 };
		assert.equal(scaleByDrag(center, center, { x: 50, y: 5 }, 1.5), 1.5);
	});
});

describe("resizeByDrag", () => {
	// A 100×20 box at (100, 100), drawn at twice its size.
	const box = { halfWidth: 50, halfHeight: 10 };
	const transform: Transform = {
		x: 100,
		y: 100,
		scaleX: 2,
		scaleY: 2,
		rotation: 0,
	};

	test("moves only the dragged side", () => {
		const resized = resizeByDrag(transform, box, "right", { x: 20, y: 7 }, 1);
		assert.deepEqual(resized.box, { halfWidth: 60, halfHeight: 10 });
		// The left side stays at x = 0: the center moves half as far, scaled.
		near(resized.transform.x, 120);
		near(resized.transform.y, 100);
		assert.equal(resized.transform.scaleX, 2);
	});

	test("moves both sides that meet at a corner", () => {
		const resized = resizeByDrag(
			transform,
			box,
			"top-left",
			{ x: -10, y: -4 },
			1,
		);
		assert.deepEqual(resized.box, { halfWidth: 55, halfHeight: 12 });
		// The bottom-right corner stays at (200, 120).
		near(resized.transform.x + 55 * 2, 200);
		near(resized.transform.y + 12 * 2, 120);
	});

	test("keeps the opposite side put in the layer's rotated frame", () => {
		const turned = { ...transform, rotation: Math.PI / 2 };
		const resized = resizeByDrag(turned, box, "left", { x: -30, y: 0 }, 1);
		assert.equal(resized.box.halfWidth, 65);
		// A quarter turn points the layer's x axis down, so the right side,
		// which stays put, is at y = 200, and the box now reaches up to y = -60.
		near(resized.transform.x, 100);
		near(resized.transform.y, 70);
		near(resized.transform.y + 65 * 2, 200);
	});

	test("stops at the minimum size rather than flipping", () => {
		const resized = resizeByDrag(transform, box, "bottom", { x: 0, y: -50 }, 4);
		assert.equal(resized.box.halfHeight, 2);
		// The top side stays at y = 80.
		near(resized.transform.y - 2 * 2, 80);
	});

	test("lets a box already under the minimum grow without jumping", () => {
		const thin = { halfWidth: 50, halfHeight: 1 };
		const held = resizeByDrag(transform, thin, "bottom", { x: 0, y: 0 }, 4);
		assert.equal(held.box.halfHeight, 1);
		near(held.transform.y, 100);
	});
});

describe("resizeLockedByDrag", () => {
	const box = { halfWidth: 50, halfHeight: 10 };
	const transform: Transform = {
		x: 100,
		y: 100,
		scaleX: 2,
		scaleY: 2,
		rotation: 0,
	};

	test("keeps a side resize at the box's original proportions", () => {
		const resized = resizeLockedByDrag(
			transform,
			box,
			"right",
			{ x: 20, y: 0 },
			1,
		);
		assert.deepEqual(resized.box, { halfWidth: 60, halfHeight: 12 });
		// The left side stays put, while the height expands around its center.
		near(resized.transform.x, 120);
		near(resized.transform.y, 100);
	});

	test("uses the further relative corner drag to choose the locked size", () => {
		const resized = resizeLockedByDrag(
			transform,
			box,
			"bottom-right",
			{ x: 10, y: 6 },
			1,
		);
		assert.deepEqual(resized.box, { halfWidth: 65, halfHeight: 13 });
		// The top-left remains fixed while the more-proportional size wins.
		near(resized.transform.x - resized.box.halfWidth * 2, 0);
		near(resized.transform.y - resized.box.halfHeight * 2, 80);
	});
});

describe("rotateByDrag", () => {
	test("adds the angle swept around the center", () => {
		const center = { x: 0, y: 0 };
		// From straight up to straight right is a quarter turn clockwise.
		near(
			rotateByDrag(center, { x: 0, y: -10 }, { x: 10, y: 0 }, 0.1),
			0.1 + Math.PI / 2,
		);
	});
});
