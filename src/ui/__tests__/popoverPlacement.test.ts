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
