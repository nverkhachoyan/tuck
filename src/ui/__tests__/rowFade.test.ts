/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fadeCut, fadeCutLeft, leafEdges, rowEdges } from "../rowFade.ts";

describe("rowEdges", () => {
	test("adds each option's x to its group's and its parents'", () => {
		const edges = rowEdges(
			{ g1: 0, g2: 100 },
			{
				a: { parent: "g1", x: 10, width: 40 },
				control: { parent: "g2", x: 5, width: 60 },
				segment: { parent: "control", x: 20, width: 30 },
			},
		);
		assert.deepEqual(edges, [
			{ left: 10, right: 50 },
			{ left: 105, right: 165 },
			{ left: 125, right: 155 },
		]);
	});

	test("leaves out an option whose group isn't measured yet", () => {
		assert.deepEqual(
			rowEdges({}, { a: { parent: "g1", x: 10, width: 40 } }),
			[],
		);
	});
});

describe("leafEdges", () => {
	test("drops a box that only holds smaller options", () => {
		const control = { left: 0, right: 100 };
		const first = { left: 0, right: 50 };
		const second = { left: 50, right: 100 };
		assert.deepEqual(leafEdges([control, first, second]), [first, second]);
	});

	test("keeps options side by side", () => {
		const edges = [
			{ left: 0, right: 40 },
			{ left: 42, right: 80 },
		];
		assert.deepEqual(leafEdges(edges), edges);
	});
});

describe("fadeCut", () => {
	const edges = [
		{ left: 0, right: 40 },
		{ left: 42, right: 80 },
		{ left: 82, right: 120 },
	];

	test("ends on the first option that doesn't fit whole", () => {
		assert.equal(fadeCut(edges, 100), 82);
	});

	test("is null when the row already ends between options", () => {
		assert.equal(fadeCut(edges, 81), null);
		assert.equal(fadeCut(edges, 120), null);
	});
});

describe("fadeCutLeft", () => {
	const edges = [
		{ left: 0, right: 40 },
		{ left: 42, right: 80 },
		{ left: 82, right: 120 },
	];

	test("ends on the last option that runs in from the left", () => {
		assert.equal(fadeCutLeft(edges, 50), 80);
	});

	test("is null at the start, or between options", () => {
		assert.equal(fadeCutLeft(edges, 0), null);
		assert.equal(fadeCutLeft(edges, 81), null);
	});
});
