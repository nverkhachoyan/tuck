/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	defaultPenSettings,
	PEN_SIZES,
	parsePenSettings,
	penBrushFor,
	penColor,
	stepPenSize,
	withPenColor,
	withPenSize,
} from "../penSettings.ts";

describe("penBrushFor", () => {
	test("sizes the pen by the canvas's shorter side", () => {
		const brush = penBrushFor(defaultPenSettings, {
			width: 4000,
			height: 3000,
		});
		assert.deepEqual(brush, {
			type: "pen",
			color: defaultPenSettings.color,
			width: PEN_SIZES.pen[defaultPenSettings.sizes.pen] * 3000,
		});
	});

	test("gives a highlighter its own color and marker tip", () => {
		const settings = {
			...defaultPenSettings,
			tip: "marker" as const,
			color: "#0A84FF",
			highlightColor: "#FFD60A",
		};
		const brush = penBrushFor(settings, { width: 1000, height: 2000 });
		assert.deepEqual(brush, {
			type: "pen",
			color: "#FFD60A",
			width: PEN_SIZES.marker[settings.sizes.marker] * 1000,
			tip: "marker",
		});
	});

	test("gives neon the shared color and neon tip", () => {
		const settings = {
			...defaultPenSettings,
			tip: "neon" as const,
			color: "#0A84FF",
		};
		const brush = penBrushFor(settings, { width: 1000, height: 2000 });
		assert.deepEqual(brush, {
			type: "pen",
			color: "#0A84FF",
			width: PEN_SIZES.neon[settings.sizes.neon] * 1000,
			tip: "neon",
		});
	});
});

describe("penColor & withPenColor", () => {
	test("returns highlightColor for marker, color for other tips", () => {
		const settings = {
			...defaultPenSettings,
			color: "#FF0000",
			highlightColor: "#00FF00",
		};
		assert.equal(penColor({ ...settings, tip: "pen" }), "#FF0000");
		assert.equal(penColor({ ...settings, tip: "marker" }), "#00FF00");
		assert.equal(penColor({ ...settings, tip: "ink" }), "#FF0000");
	});

	test("withPenColor updates highlightColor for marker, color for others", () => {
		const updatedMarker = withPenColor(
			{ ...defaultPenSettings, tip: "marker" },
			"#ABCDEF",
		);
		assert.equal(updatedMarker.highlightColor, "#ABCDEF");
		assert.equal(updatedMarker.color, defaultPenSettings.color);

		const updatedPen = withPenColor(
			{ ...defaultPenSettings, tip: "pen" },
			"#ABCDEF",
		);
		assert.equal(updatedPen.color, "#ABCDEF");
	});
});

describe("stepPenSize & withPenSize", () => {
	test("steps size index clamped to valid range", () => {
		const atMin = withPenSize({ ...defaultPenSettings, tip: "pen" }, 0);
		assert.equal(stepPenSize(atMin, -1).sizes.pen, 0);
		assert.equal(stepPenSize(atMin, 1).sizes.pen, 1);

		const maxIdx = PEN_SIZES.pen.length - 1;
		const atMax = withPenSize({ ...defaultPenSettings, tip: "pen" }, maxIdx);
		assert.equal(stepPenSize(atMax, 1).sizes.pen, maxIdx);
		assert.equal(stepPenSize(atMax, -1).sizes.pen, maxIdx - 1);
	});
});

describe("parsePenSettings", () => {
	test("falls back to default on invalid input", () => {
		assert.deepEqual(parsePenSettings(null), defaultPenSettings);
		assert.deepEqual(parsePenSettings("invalid"), defaultPenSettings);
	});

	test("migrates from legacy brush settings", () => {
		const legacy = {
			tool: "neon",
			lastBrush: "neon",
			color: "#123456",
			highlightColor: "#654321",
			sizes: { pen: 0, marker: 1, ink: 2, neon: 3 },
		};
		const parsed = parsePenSettings(legacy);
		assert.equal(parsed.tip, "neon");
		assert.equal(parsed.color, "#123456");
		assert.equal(parsed.highlightColor, "#654321");
		assert.equal(parsed.sizes.neon, 3);
	});
});
