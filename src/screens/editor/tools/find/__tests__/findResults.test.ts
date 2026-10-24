/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EditorDocument } from "../../../../../model/document.ts";
import type { ImageLayer } from "../../../../../model/layers/image.ts";
import {
	chosenBoxes,
	detectionTargetKey,
	type FoundRegion,
} from "../findResults.ts";

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

	test("says what was found, or null for both kinds", () => {
		assert.equal(chosenBoxes(regions, new Set([0, 1]))?.feature, "faces");
		assert.equal(chosenBoxes(regions, new Set([2]))?.feature, "text");
		assert.equal(chosenBoxes(regions, new Set([1, 2]))?.feature, null);
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

function image(id: string, overrides: Partial<ImageLayer> = {}): ImageLayer {
	return {
		type: "image",
		id,
		uri: `file:///${id}.jpg`,
		width: 800,
		height: 600,
		flipped: false,
		opaque: true,
		transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0 },
		hidden: false,
		locked: false,
		...overrides,
	};
}

describe("detectionTargetKey", () => {
	test("changes whenever image geometry or document size changes", () => {
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [],
		};
		const base = image("photo");
		const key1 = detectionTargetKey(doc, base);
		const keySame = detectionTargetKey(doc, { ...base });
		assert.equal(key1, keySame);

		const keyMoved = detectionTargetKey(doc, {
			...base,
			transform: { ...base.transform, x: 405 },
		});
		assert.notEqual(key1, keyMoved);

		const keyRotated = detectionTargetKey(doc, {
			...base,
			transform: { ...base.transform, rotation: 0.1 },
		});
		assert.notEqual(key1, keyRotated);

		const keyFlipped = detectionTargetKey(doc, { ...base, flipped: true });
		assert.notEqual(key1, keyFlipped);

		const keyDocResized = detectionTargetKey({ ...doc, width: 1000 }, base);
		assert.notEqual(key1, keyDocResized);
	});

	test("handles null target layer", () => {
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [],
		};
		assert.equal(detectionTargetKey(doc, null), "none:800:600");
	});
});
