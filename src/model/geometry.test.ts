/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	hitTestBox,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
	transformsEqual,
} from "./geometry.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be ${expected}`,
	);

describe("toLayerSpace", () => {
	test("undoes translate, then rotate, then scale", () => {
		const transform: Transform = {
			x: 100,
			y: 50,
			scaleX: 2,
			scaleY: 2,
			rotation: Math.PI / 2,
		};
		// Local (10, 0), scaled to (20, 0), rotated 90° to (0, 20), moved by (100, 50).
		const local = toLayerSpace(transform, { x: 100, y: 70 });
		near(local.x, 10);
		near(local.y, 0);
	});
});

describe("hitTestBox", () => {
	const wide: Transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

	test("accepts points inside the box and rejects points outside", () => {
		assert.ok(hitTestBox(wide, 50, 10, { x: 49, y: 9 }));
		assert.ok(!hitTestBox(wide, 50, 10, { x: 51, y: 0 }));
	});

	test("follows the layer's rotation", () => {
		const upright = { ...wide, rotation: Math.PI / 2 };
		// Rotated 90°, the 100×20 box now runs vertically.
		assert.ok(hitTestBox(upright, 50, 10, { x: 0, y: 49 }));
		assert.ok(!hitTestBox(upright, 50, 10, { x: 49, y: 0 }));
	});
});

describe("toDocumentSpace", () => {
	test("inverts toLayerSpace", () => {
		const transform: Transform = {
			x: 30,
			y: -20,
			scaleX: 1.5,
			scaleY: 1.5,
			rotation: 0.7,
		};
		const back = toDocumentSpace(
			transform,
			toLayerSpace(transform, { x: 12, y: 34 }),
		);
		near(back.x, 12);
		near(back.y, 34);
	});
});

describe("transformsEqual", () => {
	const transform: Transform = {
		x: 1,
		y: 2,
		scaleX: 3,
		scaleY: 3,
		rotation: 4,
	};

	test("compares every field", () => {
		assert.ok(transformsEqual(transform, { ...transform }));
		assert.ok(!transformsEqual(transform, { ...transform, rotation: 0 }));
		assert.ok(!transformsEqual(transform, { ...transform, scaleY: 1 }));
	});
});
