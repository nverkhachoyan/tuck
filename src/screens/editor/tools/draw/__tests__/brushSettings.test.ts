/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createShapeLayer } from "../../../../../model/layers/shape.ts";
import {
	BRUSH_SIZES,
	brushFor,
	brushSizeIndex,
	defaultBrushSettings,
	parseBrushSettings,
	shapeEdit,
	shapeStyleFor,
	withShape,
} from "../brushSettings.ts";

const sizes = { pen: 2, marker: 0, neon: 3, shape: 1, eraser: 4 };

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

describe("parseBrushSettings", () => {
	test("reads back settings saved as they are", () => {
		const settings = {
			tool: "shape" as const,
			lastBrush: "neon" as const,
			color: "#6B2FA0",
			shape: "ellipse" as const,
			sizes: { pen: 0, marker: 4, neon: 2, shape: 3, eraser: 1 },
		};
		assert.deepEqual(
			parseBrushSettings(JSON.parse(JSON.stringify(settings))),
			settings,
		);
	});

	test("is the default when nothing, or nothing like settings, was saved", () => {
		for (const saved of [undefined, null, "pen", 3]) {
			assert.deepEqual(parseBrushSettings(saved), defaultBrushSettings);
		}
	});

	test("replaces only what isn't valid with the default's", () => {
		// As an older build might save it: one size for pens, and no sizes
		// or shape for tools it doesn't have.
		assert.deepEqual(
			parseBrushSettings({
				tool: "chalk",
				color: "#ff3b3",
				shape: "star",
				penSize: 4,
				sizes: { pen: 4, marker: 5, neon: -1 },
			}),
			{
				...defaultBrushSettings,
				sizes: { ...defaultBrushSettings.sizes, pen: 4 },
			},
		);
	});

	test("migrates an older saved brush tool into the last brush", () => {
		const saved = {
			tool: "neon",
			color: "#0A84FF",
			shape: "arrow",
			sizes: defaultBrushSettings.sizes,
		};
		assert.deepEqual(parseBrushSettings(saved), {
			...saved,
			lastBrush: "neon",
		});
	});

	test("uses pen as the last brush when an old non-brush tool has none", () => {
		assert.equal(parseBrushSettings({ tool: "shape" }).lastBrush, "pen");
	});
});

describe("shapes", () => {
	const canvas = { width: 4000, height: 3000 };
	const settings = { ...defaultBrushSettings, tool: "shape" as const, sizes };
	const arrow = createShapeLayer(
		"arrow",
		{ x: 0, y: 0, rotation: 0, width: 400, height: 0 },
		{ color: "#0A84FF", strokeWidth: BRUSH_SIZES.shape[3] * 3000 },
	);

	test("outline in the color, sized by the canvas's shorter side", () => {
		assert.deepEqual(shapeStyleFor(settings, canvas), {
			color: settings.color,
			strokeWidth: BRUSH_SIZES.shape[1] * 3000,
		});
	});

	test("show a shape's kind, color, and nearest size, as it's scaled", () => {
		const shown = withShape(settings, arrow, canvas);
		assert.equal(shown.shape, "arrow");
		assert.equal(shown.color, "#0A84FF");
		assert.equal(shown.sizes.shape, 3);
		// Twice as thick on the canvas: the next size up and more.
		const scaled = { ...arrow, transform: { ...arrow.transform, scaleX: 2 } };
		assert.equal(withShape(settings, scaled, canvas).sizes.shape, 4);
		// The other tools keep their sizes.
		assert.equal(shown.sizes.pen, sizes.pen);
	});

	test("restyle a shape with only what changed, in its own units", () => {
		assert.deepEqual(shapeEdit(settings, settings, canvas, 1), {});
		assert.deepEqual(
			shapeEdit(settings, { ...settings, color: "#FFFFFF" }, canvas, 1),
			{ color: "#FFFFFF" },
		);
		assert.deepEqual(
			shapeEdit(settings, { ...settings, shape: "line" }, canvas, 1),
			{ shape: "line" },
		);
		const thicker = { ...settings, sizes: { ...sizes, shape: 2 } };
		assert.deepEqual(shapeEdit(settings, thicker, canvas, 2), {
			strokeWidth: (BRUSH_SIZES.shape[2] * 3000) / 2,
		});
	});
});
