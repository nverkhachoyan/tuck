/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { snapAngle, snapTo } from "./snapping.ts";

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
