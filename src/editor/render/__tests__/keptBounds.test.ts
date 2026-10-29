/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { keptBounds } from "../keptBounds.ts";

function image(
	width: number,
	height: number,
	alphas: [number, number, number][],
) {
	const pixels = new Uint8Array(width * height * 4);
	for (const [x, y, alpha] of alphas) pixels[(y * width + x) * 4 + 3] = alpha;
	return pixels;
}

describe("keptBounds", () => {
	test("holds every kept pixel", () => {
		const pixels = image(6, 5, [
			[2, 1, 255],
			[4, 3, 128],
			[1, 2, 40],
		]);
		assert.deepEqual(keptBounds(pixels, 6, 5), {
			x: 1,
			y: 1,
			width: 4,
			height: 3,
		});
	});

	test("leaves out a faint haze", () => {
		const pixels = image(6, 5, [
			[0, 0, 3],
			[3, 2, 255],
			[5, 4, 7],
		]);
		assert.deepEqual(keptBounds(pixels, 6, 5), {
			x: 3,
			y: 2,
			width: 1,
			height: 1,
		});
	});

	test("is null when nothing is kept", () => {
		assert.equal(keptBounds(image(3, 3, [[1, 1, 5]]), 3, 3), null);
	});
});
