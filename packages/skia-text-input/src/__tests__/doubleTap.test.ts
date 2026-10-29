/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDoubleTap } from "../doubleTap.ts";

describe("createDoubleTap", () => {
	test("tells a second tap, soon and near, from a first", () => {
		const taps = createDoubleTap();
		assert.equal(taps.tap({ x: 10, y: 10 }, 1000), false);
		assert.equal(taps.tap({ x: 14, y: 12 }, 1200), true);
	});

	test("starts over after a second tap, so a third is a first", () => {
		const taps = createDoubleTap();
		taps.tap({ x: 10, y: 10 }, 1000);
		taps.tap({ x: 10, y: 10 }, 1100);
		assert.equal(taps.tap({ x: 10, y: 10 }, 1200), false);
	});

	test("counts a late or distant tap as a new first", () => {
		const taps = createDoubleTap();
		taps.tap({ x: 10, y: 10 }, 1000);
		assert.equal(taps.tap({ x: 10, y: 10 }, 1400), false);
		assert.equal(taps.tap({ x: 40, y: 10 }, 1500), false);
		assert.equal(taps.tap({ x: 42, y: 10 }, 1600), true);
	});
});
