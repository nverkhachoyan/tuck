/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	checkCanvasSize,
	DEFAULT_CUSTOM_SIZE,
	parseCustomSize,
} from "../canvasSize.ts";

describe("checkCanvasSize", () => {
	test("accepts sides within the limits", () => {
		assert.deepEqual(checkCanvasSize("1200", "630"), {
			size: { width: 1200, height: 630 },
			problem: null,
		});
		assert.deepEqual(checkCanvasSize("16", "8192").size, {
			width: 16,
			height: 8192,
		});
	});

	test("waits without a problem while a field is empty", () => {
		assert.deepEqual(checkCanvasSize("", "800"), {
			size: null,
			problem: null,
		});
	});

	test("rejects a side out of range", () => {
		for (const [width, height] of [
			["15", "800"],
			["800", "8193"],
			["0", "0"],
		]) {
			const check = checkCanvasSize(width, height);
			assert.equal(check.size, null);
			assert.match(check.problem ?? "", /16 to 8,192 pixels/);
		}
	});

	test("rejects more pixels than a photo can have", () => {
		const check = checkCanvasSize("8000", "4000");
		assert.equal(check.size, null);
		assert.equal(check.problem, "That's 32 megapixels. The most is 25.");
		assert.notEqual(checkCanvasSize("5000", "5000").size, null);
	});
});

describe("parseCustomSize", () => {
	test("keeps a valid saved size", () => {
		assert.deepEqual(parseCustomSize({ width: 640, height: 480 }), {
			width: 640,
			height: 480,
		});
	});

	test("falls back to the default for anything else", () => {
		for (const saved of [
			undefined,
			null,
			"1080",
			{ width: 640 },
			{ width: 1.5, height: 480 },
			{ width: 9000, height: 9000 },
		]) {
			assert.deepEqual(parseCustomSize(saved), DEFAULT_CUSTOM_SIZE);
		}
	});
});
