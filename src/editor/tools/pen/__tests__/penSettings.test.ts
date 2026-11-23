/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../../layers/drawing/drawing.ts";
import {
	defaultPenSettings,
	MIN_OPACITY,
	markPatch,
	PEN_SIZE_RANGE,
	PEN_SIZES,
	parsePenSettings,
	penBrushFor,
	penColor,
	presetIndex,
	sizeToSlider,
	sliderToSize,
	stepPenSize,
	withPenColor,
	withPenEnds,
	withPenOpacity,
	withPenSize,
	withSelectedMark,
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
			width: defaultPenSettings.sizes.pen * 3000,
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
			width: settings.sizes.marker * 1000,
			tip: "marker",
			ends: "rounded",
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
			width: settings.sizes.neon * 1000,
			tip: "neon",
		});
	});

	test("saves ends only where a tip has them and they aren't square", () => {
		const ink = { ...defaultPenSettings, tip: "ink" as const };
		const size = { width: 1000, height: 1000 };
		assert.equal(penBrushFor(ink, size).ends, "rounded");
		assert.equal(penBrushFor(withPenEnds(ink, "square"), size).ends, undefined);
		assert.equal(penBrushFor(withPenEnds(ink, "round"), size).ends, "round");
		assert.equal(
			penBrushFor({ ...defaultPenSettings, tip: "neon" }, size).ends,
			undefined,
		);
	});

	test("saves opacity only where it isn't the tip's own", () => {
		const size = { width: 1000, height: 1000 };
		assert.equal(penBrushFor(defaultPenSettings, size).opacity, undefined);
		const faded = withPenOpacity(defaultPenSettings, 0.5);
		assert.equal(penBrushFor(faded, size).opacity, 0.5);
		const ink = { ...defaultPenSettings, tip: "ink" as const };
		assert.equal(penBrushFor(ink, size).opacity, undefined);
		const highlight = { ...defaultPenSettings, tip: "marker" as const };
		assert.equal(withPenOpacity(highlight, 0.3), highlight);
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
	test("steps the width by a sixth, within the tip's range", () => {
		const pen = { ...defaultPenSettings, tip: "pen" as const };
		const bigger = stepPenSize(pen, 1);
		assert.ok(bigger.sizes.pen > pen.sizes.pen);
		assert.ok(stepPenSize(bigger, -1).sizes.pen - pen.sizes.pen < 1e-4);

		const [min, max] = PEN_SIZE_RANGE.pen;
		const atMin = withPenSize(pen, 0);
		assert.equal(atMin.sizes.pen, min);
		assert.equal(stepPenSize(atMin, -1), atMin);
		const atMax = withPenSize(pen, 1);
		assert.equal(atMax.sizes.pen, max);
		assert.equal(stepPenSize(atMax, 1), atMax);
	});

	test("the slider runs across the range and back", () => {
		const [min, max] = PEN_SIZE_RANGE.ink;
		assert.equal(sliderToSize("ink", 0), min);
		assert.equal(sliderToSize("ink", 1), max);
		const share = PEN_SIZES.ink[2];
		assert.ok(
			Math.abs(sliderToSize("ink", sizeToSlider("ink", share)) - share) < 1e-4,
		);
	});

	test("marks a quick pick only while the width is one", () => {
		assert.equal(presetIndex("pen", PEN_SIZES.pen[3]), 3);
		assert.equal(presetIndex("pen", PEN_SIZES.pen[3] * 1.2), -1);
	});
});

describe("parsePenSettings", () => {
	test("falls back to default on invalid input", () => {
		assert.deepEqual(parsePenSettings(null), defaultPenSettings);
		assert.deepEqual(parsePenSettings("invalid"), defaultPenSettings);
	});

	test("migrates from legacy brush settings and size indexes", () => {
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
		assert.equal(parsed.sizes.pen, PEN_SIZES.pen[0]);
		assert.equal(parsed.sizes.neon, PEN_SIZES.neon[3]);
		assert.deepEqual(parsed.ends, defaultPenSettings.ends);
		assert.equal(parsed.smoothing, defaultPenSettings.smoothing);
	});

	test("restores free widths, opacities, ends, and smoothing", () => {
		const parsed = parsePenSettings({
			sizes: { pen: 0.0123, marker: 5 },
			opacity: { pen: 0.4, ink: 0.01, neon: "x" },
			ends: { marker: "square", ink: "chisel" },
			smoothing: "strong",
		});
		assert.equal(parsed.sizes.pen, 0.0123);
		assert.equal(parsed.sizes.marker, defaultPenSettings.sizes.marker);
		assert.equal(parsed.opacity.pen, 0.4);
		assert.equal(parsed.opacity.ink, MIN_OPACITY);
		assert.equal(parsed.opacity.neon, defaultPenSettings.opacity.neon);
		assert.equal(parsed.ends.marker, "square");
		assert.equal(parsed.ends.ink, defaultPenSettings.ends.ink);
		assert.equal(parsed.smoothing, "strong");
	});
});

describe("withSelectedMark and markPatch", () => {
	const size = { width: 1000, height: 2000 };

	test("shows a highlight's tip, its color as the highlight color, its width and ends", () => {
		const layer = createDrawingLayer({
			type: "pen",
			color: "#30D158",
			width: 41,
			tip: "marker",
			points: [0, 0, 10, 0],
		});
		const settings = withSelectedMark(defaultPenSettings, layer, size);
		assert.equal(settings.tip, "marker");
		assert.equal(settings.highlightColor, "#30D158");
		assert.equal(settings.color, defaultPenSettings.color);
		assert.equal(settings.sizes.marker, 0.041);
		// Saved before ends existed, so square.
		assert.equal(settings.ends.marker, "square");
	});

	test("shows a marker's opacity", () => {
		const layer = createDrawingLayer({
			type: "pen",
			color: "#30D158",
			width: 20,
			tip: "ink",
			ends: "round",
			opacity: 0.8,
			points: [0, 0, 10, 0],
		});
		const settings = withSelectedMark(defaultPenSettings, layer, size);
		assert.equal(settings.opacity.ink, 0.8);
		assert.equal(settings.ends.ink, "round");
	});

	test("lists only what changed", () => {
		const before = defaultPenSettings;
		assert.deepEqual(markPatch(before, before, size), {});
		assert.deepEqual(markPatch(before, withPenColor(before, "#0A84FF"), size), {
			color: "#0A84FF",
		});
		const bigger = withPenSize(before, before.sizes.pen * 2);
		assert.deepEqual(Object.keys(markPatch(before, bigger, size)), ["width"]);
		assert.deepEqual(markPatch(before, withPenOpacity(before, 0.5), size), {
			opacity: 0.5,
		});
		assert.equal(
			markPatch(before, { ...before, tip: "neon" }, size).tip,
			"neon",
		);
		assert.equal(markPatch({ ...before, tip: "neon" }, before, size).tip, null);
	});

	test("a new tip with ends brings its ends", () => {
		const before = defaultPenSettings;
		const after = withPenEnds({ ...before, tip: "marker" }, "round");
		const patch = markPatch(before, after, size);
		assert.equal(patch.tip, "marker");
		assert.equal(patch.ends, "round");
	});
});
