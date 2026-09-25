/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BRUSH_SIZES,
	brushFor,
	brushSizeIndex,
	defaultBrushSettings,
} from "./brushSettings.ts";

const sizes = { pen: 2, marker: 0, neon: 3, eraser: 4 };

describe("brushFor", () => {
	test("sizes the pen by the canvas's shorter side", () => {
		const brush = brushFor(
			{ ...defaultBrushSettings, sizes },
			{ width: 4000, height: 3000 },
		);
		assert.deepEqual(brush, {
			type: "pen",
			color: defaultBrushSettings.color,
			width: BRUSH_SIZES.pen[2] * 3000,
		});
	});

	test("gives a marker or a neon pen its tip, and its own sizes", () => {
		const settings = { ...defaultBrushSettings, color: "#0A84FF", sizes };
		const size = { width: 1000, height: 2000 };
		assert.deepEqual(brushFor({ ...settings, tool: "marker" }, size), {
			type: "pen",
			color: "#0A84FF",
			width: BRUSH_SIZES.marker[0] * 1000,
			tip: "marker",
		});
		assert.deepEqual(brushFor({ ...settings, tool: "neon" }, size), {
			type: "pen",
			color: "#0A84FF",
			width: BRUSH_SIZES.neon[3] * 1000,
			tip: "neon",
		});
	});

	test("uses the eraser's own size, and no color", () => {
		const brush = brushFor(
			{ ...defaultBrushSettings, tool: "eraser", sizes },
			{ width: 1000, height: 2000 },
		);
		assert.deepEqual(brush, {
			type: "eraser",
			width: BRUSH_SIZES.eraser[4] * 1000,
		});
	});
});

describe("brushSizeIndex", () => {
	test("is the size of the tool in use", () => {
		const settings = { ...defaultBrushSettings, sizes };
		assert.equal(brushSizeIndex({ ...settings, tool: "neon" }), 3);
		assert.equal(brushSizeIndex({ ...settings, tool: "marker" }), 0);
	});
});

test("every tool has a size for each size dot", () => {
	const counts = Object.values(BRUSH_SIZES).map((widths) => widths.length);
	assert.deepEqual(new Set(counts), new Set([5]));
});
