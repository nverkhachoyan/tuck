/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toDocumentSpace } from "../../../../model/geometry.ts";
import { dragLineEnd, lineBetween, shapeFromDrag } from "../shapeDrag.ts";

const near = (actual: number, expected: number) =>
	assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("shapeFromDrag", () => {
	test("puts a box between the drag's ends, either way round", () => {
		const box = { x: 150, y: 250, rotation: 0, width: 100, height: 300 };
		assert.deepEqual(
			shapeFromDrag("rectangle", { x: 100, y: 100 }, { x: 200, y: 400 }),
			box,
		);
		assert.deepEqual(
			shapeFromDrag("ellipse", { x: 200, y: 400 }, { x: 100, y: 100 }),
			box,
		);
	});

	test("runs a line from where the drag began to where it ended", () => {
		const line = shapeFromDrag("arrow", { x: 0, y: 0 }, { x: 300, y: 400 });
		assert.equal(line.width, 500);
		near(line.x, 150);
		near(line.y, 200);
		near(line.rotation, Math.atan2(400, 300));
	});
});

describe("lineBetween", () => {
	test("settles near a quarter turn, keeping its pivot put", () => {
		const tail = { x: 0, y: 0 };
		const line = lineBetween(tail, { x: 100, y: 3 }, "tail");
		assert.equal(line.snapped, true);
		assert.equal(line.rotation, 0);
		near(line.y, 0);
		near(line.x - line.width / 2, 0);

		const head = { x: 100, y: 3 };
		const pivoted = lineBetween(tail, head, "head");
		near(pivoted.y, 3);
		near(pivoted.x + pivoted.width / 2, 100);
	});

	test("keeps an angle that isn't near a quarter turn", () => {
		const line = lineBetween({ x: 0, y: 0 }, { x: 100, y: 100 }, "tail");
		assert.equal(line.snapped, false);
		near(line.rotation, Math.PI / 4);
	});

	test("reaches at least the minimum length, on from the pivot", () => {
		const line = lineBetween({ x: 0, y: 0 }, { x: 0, y: 2 }, "tail", 20);
		assert.equal(line.width, 20);
		near(line.y, 10);
	});
});

describe("dragLineEnd", () => {
	const transform = { x: 100, y: 100, scaleX: 2, scaleY: 2, rotation: 0 };

	test("moves the dragged end, leaving the other where it was", () => {
		// Ends at x = 0 and 200: its half length, 50, is scaled by 2.
		const line = dragLineEnd(transform, 50, 1, { x: -200, y: 200 }, 0);
		near(line.rotation, Math.PI / 2);
		const moved = { ...transform, ...line };
		const tail = toDocumentSpace(
			{ ...moved, scaleX: 1, scaleY: 1 },
			{ x: -line.width / 2, y: 0 },
		);
		near(tail.x, 0);
		near(tail.y, 100);
		// In document units: the layer's own length is half that.
		near(line.width, 200);
	});

	test("turns about the head when the tail is dragged", () => {
		const line = dragLineEnd(transform, 50, -1, { x: 200, y: -200 }, 0);
		// The tail goes to (200, -100), right above the head at (200, 100).
		near(line.rotation, Math.PI / 2);
		near(line.x, 200);
		near(line.y, 0);
	});
});
