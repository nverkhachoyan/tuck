/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { placePopover } from "../popoverPlacement.ts";

const viewport = { width: 800, height: 600 };
const card = { width: 200, height: 120 };

describe("placePopover", () => {
	test("hangs the card below the control, lined up with its left", () => {
		assert.deepEqual(
			placePopover({ x: 40, y: 50, width: 44, height: 44 }, card, viewport),
			{ left: 40, top: 102 },
		);
	});

	test("flips above the control when the card would pass the bottom", () => {
		assert.deepEqual(
			placePopover({ x: 40, y: 500, width: 44, height: 44 }, card, viewport),
			{ left: 40, top: 372 },
		);
	});

	test("opens beside the control, top-aligned, and moves up at the bottom", () => {
		assert.deepEqual(
			placePopover(
				{ x: 40, y: 80, width: 44, height: 44 },
				card,
				viewport,
				"beside",
			),
			{ left: 92, top: 80 },
		);
		assert.deepEqual(
			placePopover(
				{ x: 40, y: 560, width: 44, height: 36 },
				card,
				viewport,
				"beside",
			),
			{ left: 92, top: 472 },
		);
	});

	test("hangs the card above the control, centered horizontally", () => {
		assert.deepEqual(
			placePopover(
				{ x: 100, y: 300, width: 44, height: 44 },
				card,
				viewport,
				"above",
			),
			{ left: 22, top: 172 },
		);
	});

	test("flips below the control when above would pass the top", () => {
		assert.deepEqual(
			placePopover(
				{ x: 100, y: 50, width: 44, height: 44 },
				card,
				viewport,
				"above",
			),
			{ left: 22, top: 102 },
		);
	});

	test("clamps to margin when fitting neither above nor below", () => {
		assert.deepEqual(
			placePopover(
				{ x: 100, y: 30, width: 44, height: 44 },
				card,
				{ width: 800, height: 140 },
				"above",
			),
			{ left: 22, top: 8 },
		);
	});

	test("clamps horizontally to keep above card within the window", () => {
		assert.deepEqual(
			placePopover(
				{ x: 10, y: 300, width: 44, height: 44 },
				card,
				viewport,
				"above",
			),
			{ left: 8, top: 172 },
		);
		assert.deepEqual(
			placePopover(
				{ x: 750, y: 300, width: 44, height: 44 },
				card,
				viewport,
				"above",
			),
			{ left: 592, top: 172 },
		);
	});

	test("keeps the card inside the window when the control is at an edge", () => {
		assert.deepEqual(
			placePopover({ x: 760, y: 8, width: 44, height: 44 }, card, viewport),
			{ left: 592, top: 60 },
		);
		// Above the control, and in from the left edge.
		assert.deepEqual(
			placePopover({ x: 4, y: 540, width: 44, height: 80 }, card, viewport),
			{ left: 8, top: 412 },
		);
	});
});
