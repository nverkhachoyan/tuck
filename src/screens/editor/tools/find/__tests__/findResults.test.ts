/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EditorDocument } from "../../../../../model/document.ts";
import type { ImageLayer } from "../../../../../model/layers/image.ts";
import {
	chosenBoxes,
	detectionAt,
	detectionTargetKey,
	type FoundRegion,
	readingOrder,
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

describe("readingOrder", () => {
	const at = (x: number, y: number, height = 20) => ({
		width: 20,
		height,
		transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 },
	});

	test("steps across each row, then down to the next", () => {
		// Two rows of faces at slightly different heights, listed out of order.
		const regions = [
			at(50, 104),
			at(10, 160),
			at(90, 98),
			at(10, 100),
			at(50, 158),
		];
		assert.deepEqual(readingOrder(regions), [3, 0, 2, 1, 4]);
	});

	test("starts a row below half the height of the row's first", () => {
		assert.deepEqual(readingOrder([at(50, 100), at(10, 111)]), [0, 1]);
		assert.deepEqual(readingOrder([at(50, 100), at(10, 110)]), [1, 0]);
	});

	test("is empty for no regions", () => {
		assert.deepEqual(readingOrder([]), []);
	});
});

describe("detectionAt", () => {
	const region = (id: string, x: number, width: number, height = width) => ({
		id,
		width,
		height,
		transform: { x, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
	});

	test("finds the region under a point, padded", () => {
		const regions = [region("a", 0, 20)];
		assert.equal(detectionAt(regions, { x: 9, y: 0 }, 0)?.id, "a");
		assert.equal(detectionAt(regions, { x: 12, y: 0 }, 0), null);
		assert.equal(detectionAt(regions, { x: 12, y: 0 }, 5)?.id, "a");
	});

	test("prefers the smallest of overlapping regions, in any order", () => {
		const big = region("big", 0, 100);
		const small = region("small", 5, 10);
		assert.equal(detectionAt([big, small], { x: 5, y: 0 }, 0)?.id, "small");
		assert.equal(detectionAt([small, big], { x: 5, y: 0 }, 0)?.id, "small");
		assert.equal(detectionAt([big, small], { x: 40, y: 0 }, 0)?.id, "big");
	});

	test("follows a region's turn", () => {
		const turned = {
			...region("long", 0, 100, 10),
			transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 },
		};
		assert.equal(detectionAt([turned], { x: 0, y: 40 }, 0)?.id, "long");
		assert.equal(detectionAt([turned], { x: 40, y: 0 }, 0), null);
	});
});
