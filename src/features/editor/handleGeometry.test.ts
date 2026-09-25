/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Transform } from "../../model/geometry.ts";
import {
	handleAt,
	handlePositions,
	rotateByDrag,
	scaleByDrag,
} from "./handleGeometry.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be ${expected}`,
	);

describe("handlePositions", () => {
	const box = { halfWidth: 50, halfHeight: 10 };

	test("puts the corners on the scaled box and the knob above it", () => {
		const transform: Transform = {
			x: 100,
			y: 100,
			scaleX: 2,
			scaleY: 2,
			rotation: 0,
		};
		const positions = handlePositions(transform, box, 30);
		near(positions["top-left"].x, 0);
		near(positions["top-left"].y, 80);
		near(positions["bottom-right"].x, 200);
		near(positions["bottom-right"].y, 120);
		// 30 units above the top edge, unaffected by the layer's scale.
		near(positions.rotate.x, 100);
		near(positions.rotate.y, 50);
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
		const { rotate } = handlePositions(quarterTurn, box, 30);
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

	test("finds the handle within the radius, or none", () => {
		assert.equal(
			handleAt(transform, box, { x: 52, y: 12 }, 5, 30),
			"bottom-right",
		);
		assert.equal(handleAt(transform, box, { x: 0, y: -40 }, 5, 30), "rotate");
		assert.equal(handleAt(transform, box, { x: 0, y: 0 }, 5, 30), null);
	});

	test("picks the nearest when handles overlap", () => {
		const tiny = { halfWidth: 2, halfHeight: 2 };
		assert.equal(
			handleAt(transform, tiny, { x: 3, y: 3 }, 10, 30),
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
