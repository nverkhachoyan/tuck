/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { snapAngle, snapSpan, snapTo } from "./snapping.ts";

describe("snapTo", () => {
	test("returns the target within the tolerance, on either side", () => {
		assert.equal(snapTo(96, 100, 5), 100);
		assert.equal(snapTo(105, 100, 5), 100);
	});

	test("returns null outside the tolerance", () => {
		assert.equal(snapTo(94, 100, 5), null);
	});
});

describe("snapAngle", () => {
	const quarter = Math.PI / 2;

	test("snaps near a multiple of the step and leaves others alone", () => {
		assert.equal(snapAngle(quarter + 0.01, quarter, 0.05), quarter);
		assert.equal(snapAngle(-quarter - 0.01, quarter, 0.05), -quarter);
		assert.equal(snapAngle(0.3, quarter, 0.05), null);
	});

	test("snaps an angle already on a multiple to that same value", () => {
		const half = snapAngle(2 * quarter, quarter, 0.05);
		assert.equal(snapAngle(half ?? Number.NaN, quarter, 0.05), half);
	});
});

describe("snapSpan", () => {
	// A canvas 200 wide: edges at 0 and 200, center line at 100.
	const snap = (center: number, halfLength: number) =>
		snapSpan(center, halfLength, [0, 200], [100], 5);

	test("snaps either end onto an edge", () => {
		assert.deepEqual(snap(43, 40), { center: 40, line: 0 });
		assert.deepEqual(snap(157, 40), { center: 160, line: 200 });
	});

	test("snaps the center onto a center line", () => {
		assert.deepEqual(snap(98, 40), { center: 100, line: 100 });
	});

	test("picks the closest line when several are in reach", () => {
		// Its end is 0.5 from 200; its center is 2.5 from 100.
		assert.deepEqual(snap(102.5, 97), { center: 103, line: 200 });
	});

	test("prefers the center line on a tie", () => {
		// As wide as the canvas: both ends and the center are 1 off.
		assert.deepEqual(snap(101, 100), { center: 100, line: 100 });
	});

	test("returns null when no line is in reach", () => {
		assert.equal(snap(60, 40), null);
	});
});
