/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { exportSizes } from "./exportSizes.ts";

const sizes = (width: number, height: number) =>
	exportSizes({ width, height }).map(({ width, height }) => [width, height]);

describe("exportSizes", () => {
	test("offers the full size, then smaller presets by the longer side", () => {
		assert.deepEqual(sizes(4032, 3024), [
			[4032, 3024],
			[2048, 1536],
			[1080, 810],
		]);
		assert.deepEqual(sizes(3024, 4032), [
			[3024, 4032],
			[1536, 2048],
			[810, 1080],
		]);
	});

	test("leaves out presets that aren't smaller", () => {
		assert.deepEqual(sizes(1500, 1000), [
			[1500, 1000],
			[1080, 720],
		]);
		assert.deepEqual(sizes(800, 600), [[800, 600]]);
	});

	test("exports an iPhone 24MP photo at its own size", () => {
		assert.deepEqual(sizes(5712, 4284)[0], [5712, 4284]);
		assert.deepEqual(sizes(4284, 5712)[0], [4284, 5712]);
	});

	test("shrinks a huge canvas to what export can hold", () => {
		// √25,000,000 = 5000.
		assert.deepEqual(sizes(8000, 8000)[0], [5000, 5000]);
		const [long] = exportSizes({ width: 12000, height: 1000 });
		assert.equal(long.width, 8192);
	});
});
