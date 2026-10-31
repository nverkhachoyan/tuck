/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createShapeLayer } from "../../../layers/shape/shape.ts";
import {
	defaultShapeSettings,
	parseShapeSettings,
	SHAPE_SIZES,
	shapePatch,
	shapeStyleFor,
	stepShapeSize,
	withSelectedShape,
} from "../shapeSettings.ts";

describe("shapeStyleFor", () => {
	test("calculates stroke width by shorter canvas side", () => {
		const style = shapeStyleFor(defaultShapeSettings, {
			width: 2000,
			height: 1000,
		});
		assert.equal(style.color, defaultShapeSettings.color);
		assert.equal(
			style.strokeWidth,
			SHAPE_SIZES[defaultShapeSettings.sizeIndex] * 1000,
		);
	});
});

describe("stepShapeSize", () => {
	test("steps size index clamped to range", () => {
		const atMin = { ...defaultShapeSettings, sizeIndex: 0 };
		assert.equal(stepShapeSize(atMin, -1).sizeIndex, 0);
		assert.equal(stepShapeSize(atMin, 1).sizeIndex, 1);

		const maxIdx = SHAPE_SIZES.length - 1;
		const atMax = { ...defaultShapeSettings, sizeIndex: maxIdx };
		assert.equal(stepShapeSize(atMax, 1).sizeIndex, maxIdx);
		assert.equal(stepShapeSize(atMax, -1).sizeIndex, maxIdx - 1);
	});
});

describe("withSelectedShape", () => {
	test("reflects shape kind, color, and closest stroke width", () => {
		const layer = createShapeLayer(
			"ellipse",
			{ x: 0, y: 0, rotation: 0, width: 100, height: 100 },
			{ color: "#00FF00", strokeWidth: 13 },
		);
		const size = { width: 1000, height: 1000 };
		const settings = withSelectedShape(defaultShapeSettings, layer, size);
		assert.equal(settings.shape, "ellipse");
		assert.equal(settings.color, "#00FF00");
		assert.equal(settings.sizeIndex, 2); // 13 / 1000 = 0.013 -> index 2
	});
});

describe("shapePatch", () => {
	test("generates patch for modified shape properties", () => {
		const before = defaultShapeSettings;
		const after = {
			...before,
			shape: "arrow" as const,
			color: "#0000FF",
			sizeIndex: 0,
		};
		const size = { width: 1000, height: 1000 };
		const patch = shapePatch(before, after, size, 1);
		assert.equal(patch.shape, "arrow");
		assert.equal(patch.color, "#0000FF");
		assert.equal(patch.strokeWidth, SHAPE_SIZES[0] * 1000);
	});
});

describe("parseShapeSettings", () => {
	test("falls back to default on invalid values", () => {
		assert.deepEqual(parseShapeSettings(null), defaultShapeSettings);
		assert.deepEqual(parseShapeSettings({}), defaultShapeSettings);
	});

	test("restores valid saved settings", () => {
		const saved = { shape: "line", color: "#123456", sizeIndex: 4 };
		const parsed = parseShapeSettings(saved);
		assert.equal(parsed.shape, "line");
		assert.equal(parsed.color, "#123456");
		assert.equal(parsed.sizeIndex, 4);
	});
});
