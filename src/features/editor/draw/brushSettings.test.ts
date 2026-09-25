/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BRUSH_SIZES,
	brushFor,
	defaultBrushSettings,
} from "./brushSettings.ts";

describe("brushFor", () => {
	test("sizes the pen by the canvas's shorter side", () => {
		const brush = brushFor(
			{ ...defaultBrushSettings, penSize: 2 },
			{ width: 4000, height: 3000 },
		);
		assert.deepEqual(brush, {
			type: "pen",
			color: defaultBrushSettings.color,
			width: BRUSH_SIZES[2] * 3000,
		});
	});

	test("uses the eraser's own size, and no color", () => {
		const brush = brushFor(
			{ ...defaultBrushSettings, tool: "eraser", penSize: 0, eraserSize: 4 },
			{ width: 1000, height: 2000 },
		);
		assert.deepEqual(brush, { type: "eraser", width: BRUSH_SIZES[4] * 1000 });
	});
});
