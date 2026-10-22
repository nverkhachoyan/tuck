/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Transform } from "../../../model/geometry.ts";
import {
	snapAngle,
	snapLinesFor,
	snapSide,
	snapSpan,
	snapTo,
} from "./snapping.ts";

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

describe("snapLinesFor", () => {
	const canvas = { width: 200, height: 100 };
	const at = (x: number, y: number, rotation = 0): Transform => ({
		x,
		y,
		scaleX: 1,
		scaleY: 1,
		rotation,
	});
	const box = { halfWidth: 20, halfHeight: 10 };

	test("starts from the canvas's edges and center", () => {
		assert.deepEqual(snapLinesFor(canvas, []), {
			x: { edges: [0, 200], centers: [100] },
			y: { edges: [0, 100], centers: [50] },
		});
	});

	test("adds each other layer's edges and center", () => {
		const lines = snapLinesFor(canvas, [
			{ transform: at(60, 40), box, clipped: false },
		]);
		assert.deepEqual(lines.x, { edges: [0, 200, 40, 80], centers: [100, 60] });
		assert.deepEqual(lines.y, { edges: [0, 100, 30, 50], centers: [50, 40] });
	});

	test("uses the upright box around a rotated layer", () => {
		const lines = snapLinesFor(canvas, [
			{ transform: at(60, 40, Math.PI / 2), box, clipped: false },
		]);
		assert.deepEqual(lines.x.edges, [0, 200, 50, 70]);
		assert.deepEqual(lines.y.edges, [0, 100, 20, 60]);
	});

	test("leaves out lines past the canvas's edges", () => {
		const lines = snapLinesFor(canvas, [
			{ transform: at(190, 50), box, clipped: false },
		]);
		assert.deepEqual(lines.x, { edges: [0, 200, 170], centers: [100, 190] });
	});

	test("counts a clipped layer only as far as the canvas shows it", () => {
		const photo = { halfWidth: 100, halfHeight: 50 };
		const clipped = snapLinesFor(canvas, [
			{ transform: at(150, 50), box: photo, clipped: true },
		]);
		assert.deepEqual(clipped.x, {
			edges: [0, 200, 50, 200],
			centers: [100, 125],
		});
		const unclipped = snapLinesFor(canvas, [
			{ transform: at(150, 50), box: photo, clipped: false },
		]);
		assert.deepEqual(unclipped.x, { edges: [0, 200, 50], centers: [100, 150] });
	});

	test("ignores a clipped layer the canvas doesn't show at all", () => {
		assert.deepEqual(
			snapLinesFor(canvas, [{ transform: at(400, 50), box, clipped: true }]),
			snapLinesFor(canvas, []),
		);
	});
});

describe("snapSide", () => {
	const lines = {
		x: { edges: [0, 200], centers: [100] },
		y: { edges: [0, 100], centers: [50] },
	};
	// A box drawn at twice its size, centered at (60, 40).
	const at = (rotation: number): Transform => ({
		x: 60,
		y: 40,
		scaleX: 2,
		scaleY: 2,
		rotation,
	});

	test("snaps an upright side onto an edge or a center line", () => {
		// Its right side, 19 units out, is at x = 98: 2 short of the center.
		assert.deepEqual(snapSide(at(0), "x", 19, lines, 5), {
			position: 20,
			guide: "x",
			line: 100,
		});
		// Its top side, 18 up, is at y = 4.
		assert.deepEqual(snapSide(at(0), "y", -18, lines, 5), {
			position: -20,
			guide: "y",
			line: 0,
		});
	});

	test("snaps along the document's other axis once turned a quarter", () => {
		// A quarter turn points the layer's x axis down: 4 units is y = 48.
		assert.deepEqual(snapSide(at(Math.PI / 2), "x", 4, lines, 5), {
			position: 5,
			guide: "y",
			line: 50,
		});
		// And its y axis to the left: 30 units is x = 0.
		assert.deepEqual(snapSide(at(Math.PI / 2), "y", 30, lines, 5), {
			position: 30,
			guide: "x",
			line: 0,
		});
	});

	test("leaves a slanted side alone, and one out of reach", () => {
		assert.equal(snapSide(at(0.3), "x", 19, lines, 5), null);
		assert.equal(snapSide(at(0), "x", 10, lines, 5), null);
	});
});
