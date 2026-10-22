/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createShapeLayer, type ShapeKind } from "../document.ts";
import { hitTestDrawing } from "../drawing.ts";
import {
	arrowHead,
	erasesShape,
	outlineThickness,
	shapeBox,
	shapeOutline,
} from "../shapes.ts";

const shape = (kind: ShapeKind, width: number, height: number) =>
	createShapeLayer(
		kind,
		{ x: 0, y: 0, rotation: 0, width, height },
		{ color: "#FF3B30", strokeWidth: 10 },
	);

describe("arrowHead", () => {
	test("is sized by the line's thickness", () => {
		assert.deepEqual(arrowHead(10, 1000), { length: 45, halfWidth: 25 });
	});

	test("shrinks to half a short arrow, keeping its proportions", () => {
		assert.deepEqual(arrowHead(10, 45), { length: 22.5, halfWidth: 12.5 });
	});
});

describe("shapeBox", () => {
	test("is a box shape's own box", () => {
		assert.deepEqual(shapeBox(shape("ellipse", 200, 100)), {
			halfWidth: 100,
			halfHeight: 50,
		});
	});

	test("runs a line's length, as wide as its thickness or its arrow's head", () => {
		assert.deepEqual(shapeBox(shape("line", 400, 0)), {
			halfWidth: 200,
			halfHeight: 5,
		});
		assert.deepEqual(shapeBox(shape("arrow", 400, 0)), {
			halfWidth: 200,
			halfHeight: 25,
		});
	});
});

describe("outlineThickness", () => {
	test("is the stroke's, unless the box is thinner", () => {
		assert.equal(outlineThickness({ halfWidth: 50, halfHeight: 50 }, 10), 10);
		assert.equal(outlineThickness({ halfWidth: 50, halfHeight: 3 }, 10), 6);
	});
});

describe("shapeOutline", () => {
	const hits = (kind: ShapeKind, x: number, y: number) =>
		hitTestDrawing(
			{ strokes: shapeOutline(shape(kind, 200, 100)) },
			{ x, y },
			0,
		);

	test("hits a box shape's outline, not its middle", () => {
		for (const kind of ["rectangle", "ellipse"] as const) {
			assert.equal(hits(kind, 98, 0), true, kind);
			assert.equal(hits(kind, 0, -48), true, kind);
			assert.equal(hits(kind, 0, 0), false, kind);
		}
		// Past an ellipse's curve, in its box's corner.
		assert.equal(hits("rectangle", 96, 46), true);
		assert.equal(hits("ellipse", 96, 46), false);
	});

	test("hits a line along its length, to its ends", () => {
		assert.equal(hits("line", 0, 4), true);
		assert.equal(hits("line", 99, 0), true);
		assert.equal(hits("line", 0, 10), false);
		assert.equal(hits("line", 101, 0), false);
	});

	test("hits an arrow's head across its width", () => {
		assert.equal(hits("arrow", 90, 20), true);
		assert.equal(hits("arrow", -90, 20), false);
	});
});

describe("erasesShape", () => {
	test("is true where the eraser crosses the outline, not inside it", () => {
		const box = shape("rectangle", 200, 100);
		// The outline runs 5 in from the box's edge, 10 thick.
		assert.equal(erasesShape(box, [0, 0, 0, -20], 10), false);
		assert.equal(erasesShape(box, [0, 0, 0, -60], 10), true);
		// The outline's ink spans y = -50 to -40: a dot just clear of it, then
		// overlapping it.
		assert.equal(erasesShape(box, [0, -33], 10), false);
		assert.equal(erasesShape(box, [0, -42], 10), true);
	});

	test("catches a thin line between a quick stroke's far-apart points", () => {
		const line = shape("line", 400, 0);
		assert.equal(erasesShape(line, [0, -300, 0, 300], 4), true);
	});

	test("follows the shape's transform", () => {
		const line = {
			...shape("line", 400, 0),
			transform: {
				x: 500,
				y: 500,
				scaleX: 2,
				scaleY: 2,
				rotation: Math.PI / 2,
			},
		};
		// Turned upright and doubled, it runs from y = 100 to 900 at x = 500.
		assert.equal(erasesShape(line, [400, 850, 600, 850], 4), true);
		assert.equal(erasesShape(line, [400, 950, 600, 950], 4), false);
	});
});
