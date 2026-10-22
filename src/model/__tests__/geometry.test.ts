/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	applyMatrix,
	boundingBox,
	cosSin,
	hitTestBox,
	invertMatrix,
	multiplyMatrices,
	normalizeAngle,
	rectFromCorners,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
	transformMatrix,
	transformsEqual,
} from "../geometry.ts";

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

describe("rectFromCorners", () => {
	test("is the same whichever way it's dragged", () => {
		const rect = { x: 10, y: 20, width: 30, height: 40 };
		assert.deepEqual(rectFromCorners({ x: 10, y: 20 }, { x: 40, y: 60 }), rect);
		assert.deepEqual(rectFromCorners({ x: 40, y: 20 }, { x: 10, y: 60 }), rect);
		assert.deepEqual(rectFromCorners({ x: 40, y: 60 }, { x: 10, y: 20 }), rect);
	});
});

describe("hitTestBox", () => {
	const wide: Transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
	const box = { halfWidth: 50, halfHeight: 10 };

	test("accepts points inside the box and rejects points outside", () => {
		assert.ok(hitTestBox(wide, box, { x: 49, y: 9 }));
		assert.ok(!hitTestBox(wide, box, { x: 51, y: 0 }));
	});

	test("follows the layer's rotation", () => {
		const upright = { ...wide, rotation: Math.PI / 2 };
		// Rotated 90°, the 100×20 box now runs vertically.
		assert.ok(hitTestBox(upright, box, { x: 0, y: 49 }));
		assert.ok(!hitTestBox(upright, box, { x: 49, y: 0 }));
	});
});

describe("boundingBox", () => {
	const at = (scale: number, rotation: number): Transform => ({
		x: 40,
		y: 30,
		scaleX: scale,
		scaleY: scale,
		rotation,
	});
	const box = { halfWidth: 10, halfHeight: 5 };

	test("scales an upright box", () => {
		assert.deepEqual(boundingBox(at(2, 0), box), {
			halfWidth: 20,
			halfHeight: 10,
		});
	});

	test("swaps the sides exactly on a quarter turn", () => {
		assert.deepEqual(boundingBox(at(1, Math.PI / 2), box), {
			halfWidth: 5,
			halfHeight: 10,
		});
	});

	test("grows to hold a rotated box's corners", () => {
		const extent = boundingBox(at(1, Math.PI / 4), box);
		near(extent.halfWidth, 15 / Math.SQRT2);
		near(extent.halfHeight, 15 / Math.SQRT2);
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

describe("cosSin", () => {
	test("is exact for quarter turns, in either direction", () => {
		assert.deepEqual(cosSin(Math.PI / 2), { cos: 0, sin: 1 });
		assert.deepEqual(cosSin(Math.PI), { cos: -1, sin: 0 });
		assert.deepEqual(cosSin(-Math.PI / 2), { cos: 0, sin: -1 });
		assert.deepEqual(cosSin(4 * Math.PI), { cos: 1, sin: 0 });
	});

	test("matches Math between quarter turns", () => {
		assert.deepEqual(cosSin(0.3), { cos: Math.cos(0.3), sin: Math.sin(0.3) });
	});
});

describe("normalizeAngle", () => {
	test("wraps into (−π, π]", () => {
		near(normalizeAngle(3 * Math.PI), Math.PI);
		near(normalizeAngle(-Math.PI), Math.PI);
		near(normalizeAngle(2 * Math.PI + 0.5), 0.5);
		near(normalizeAngle(-2 * Math.PI - 0.5), -0.5);
	});

	test("lands exactly on quarter turns that are off by rounding", () => {
		const fourTurns = [1, 2, 3, 4].reduce((angle) => angle + Math.PI / 2, 0);
		assert.equal(normalizeAngle(fourTurns), 0);
		assert.equal(normalizeAngle(Math.PI / 2 + 1e-12), Math.PI / 2);
	});
});

describe("transformMatrix", () => {
	const transform: Transform = {
		x: 30,
		y: -20,
		scaleX: 1.5,
		scaleY: 1.5,
		rotation: 0.7,
	};

	test("maps points like toDocumentSpace", () => {
		const point = { x: 12, y: 34 };
		const mapped = applyMatrix(transformMatrix(transform), point);
		const expected = toDocumentSpace(transform, point);
		near(mapped.x, expected.x);
		near(mapped.y, expected.y);
	});

	test("composes and inverts", () => {
		const other: Transform = { ...transform, x: 5, rotation: -1.2 };
		const both = multiplyMatrices(
			transformMatrix(other),
			transformMatrix(transform),
		);
		const point = { x: 7, y: -3 };
		const once = applyMatrix(both, point);
		const twice = toDocumentSpace(other, toDocumentSpace(transform, point));
		near(once.x, twice.x);
		near(once.y, twice.y);
		const back = applyMatrix(invertMatrix(both), once);
		near(back.x, point.x);
		near(back.y, point.y);
	});
});
