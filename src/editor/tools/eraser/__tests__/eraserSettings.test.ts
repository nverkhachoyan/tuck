/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	defaultEraserSettings,
	ERASER_SIZES,
	eraserBrushFor,
	parseEraserSettings,
	stepEraserSize,
} from "../eraserSettings.ts";

describe("eraserBrushFor", () => {
	test("creates eraser brush sized by shorter canvas side", () => {
		const brush = eraserBrushFor(defaultEraserSettings, {
			width: 1000,
			height: 2000,
		});
		assert.deepEqual(brush, {
			type: "eraser",
			width: ERASER_SIZES[defaultEraserSettings.sizeIndex] * 1000,
		});
	});
});

describe("stepEraserSize", () => {
	test("steps size index clamped to range", () => {
		const atMin = { sizeIndex: 0 };
		assert.equal(stepEraserSize(atMin, -1).sizeIndex, 0);
		assert.equal(stepEraserSize(atMin, 1).sizeIndex, 1);

		const maxIdx = ERASER_SIZES.length - 1;
		const atMax = { sizeIndex: maxIdx };
		assert.equal(stepEraserSize(atMax, 1).sizeIndex, maxIdx);
		assert.equal(stepEraserSize(atMax, -1).sizeIndex, maxIdx - 1);
	});
});

describe("parseEraserSettings", () => {
	test("falls back to default on invalid values", () => {
		assert.deepEqual(parseEraserSettings(null), defaultEraserSettings);
		assert.deepEqual(parseEraserSettings({}), defaultEraserSettings);
	});

	test("restores valid saved settings or legacy eraser size", () => {
		assert.equal(parseEraserSettings({ sizeIndex: 1 }).sizeIndex, 1);
		assert.equal(parseEraserSettings({ sizes: { eraser: 4 } }).sizeIndex, 4);
	});
});
