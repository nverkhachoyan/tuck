/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chosenBoxes, type FoundRegion } from "./findResults.ts";

const region = (
	sourceIndex: number,
	feature: FoundRegion["feature"],
): FoundRegion => ({
	sourceIndex,
	feature,
	width: 10 + sourceIndex,
	height: 20,
	transform: { x: sourceIndex, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
});

describe("chosenBoxes", () => {
	const regions = [region(0, "faces"), region(1, "faces"), region(2, "text")];

	test("is null when nothing is chosen", () => {
		assert.equal(chosenBoxes(regions, new Set()), null);
		assert.equal(chosenBoxes([], new Set([0])), null);
	});

	test("makes a box of each chosen region, in order", () => {
		const result = chosenBoxes(regions, new Set([1, 0]));
		assert.deepEqual(result?.boxes, [
			{ width: 10, height: 20, transform: regions[0].transform },
			{ width: 11, height: 20, transform: regions[1].transform },
		]);
	});

	test("names the group for what was found", () => {
		assert.equal(
			chosenBoxes(regions, new Set([0, 1]))?.groupName,
			"Face results",
		);
		assert.equal(chosenBoxes(regions, new Set([2]))?.groupName, "Text results");
		assert.equal(
			chosenBoxes(regions, new Set([0, 2]))?.groupName,
			"Find results",
		);
	});
});
