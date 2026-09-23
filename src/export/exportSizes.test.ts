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

	test("shrinks a huge canvas to what export can hold", () => {
		// √24,000,000 ≈ 4899.
		assert.deepEqual(sizes(8000, 8000)[0], [4899, 4899]);
		const [long] = exportSizes({ width: 12000, height: 1000 });
		assert.equal(long.width, 8192);
	});
});
