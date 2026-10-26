/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BLUR_STRENGTHS,
	defaultRedactSettings,
	maskBrush,
	PIXEL_SIZES,
	parseRedactSettings,
	REDACT_BRUSH_SIZES,
	redactionEffect,
	redactSizeIndex,
	sameEffect,
	stepRedactSize,
	withEffect,
	withRedactSize,
} from "../redactSettings.ts";

const photo = { width: 4000, height: 3000 };

describe("redactionEffect", () => {
	test("covers with the chosen color by default", () => {
		assert.deepEqual(redactionEffect(defaultRedactSettings, photo), {
			type: "solid",
			color: "#000000",
		});
	});

	test("blurs by the canvas's shorter side", () => {
		const settings = { ...defaultRedactSettings, effect: "blur" as const };
		assert.deepEqual(redactionEffect({ ...settings, strength: 2 }, photo), {
			type: "blur",
			radius: BLUR_STRENGTHS[2] * 3000,
		});
	});

	test("pixelates by the canvas's shorter side", () => {
		const settings = { ...defaultRedactSettings, effect: "pixelate" as const };
		assert.deepEqual(redactionEffect({ ...settings, strength: 0 }, photo), {
			type: "pixelate",
			size: PIXEL_SIZES[0] * 3000,
		});
	});
});

describe("maskBrush", () => {
	test("is none for boxes", () => {
		assert.equal(maskBrush(defaultRedactSettings, photo), null);
	});

	test("sizes the brush and eraser each by their own size", () => {
		const settings = { ...defaultRedactSettings, brushSize: 0, eraserSize: 4 };
		assert.deepEqual(maskBrush({ ...settings, tool: "brush" }, photo), {
			type: "pen",
			width: REDACT_BRUSH_SIZES[0] * 3000,
		});
		assert.deepEqual(maskBrush({ ...settings, tool: "eraser" }, photo), {
			type: "eraser",
			width: REDACT_BRUSH_SIZES[4] * 3000,
		});
	});
});

describe("redactSizeIndex", () => {
	const settings = { ...defaultRedactSettings, brushSize: 0, eraserSize: 4 };

	test("is the brush's or the eraser's own size", () => {
		assert.equal(redactSizeIndex({ ...settings, tool: "brush" }), 0);
		assert.equal(redactSizeIndex({ ...settings, tool: "eraser" }), 4);
	});

	test("is none for boxes", () => {
		assert.equal(redactSizeIndex({ ...settings, tool: "box" }), null);
	});
});

describe("withRedactSize", () => {
	const settings = { ...defaultRedactSettings, brushSize: 0, eraserSize: 4 };

	test("changes only the size of the tool in use", () => {
		const brush = { ...settings, tool: "brush" as const };
		assert.deepEqual(withRedactSize(brush, 3), { ...brush, brushSize: 3 });
		const eraser = { ...settings, tool: "eraser" as const };
		assert.deepEqual(withRedactSize(eraser, 1), { ...eraser, eraserSize: 1 });
	});

	test("leaves a box's settings as they are", () => {
		const box = { ...settings, tool: "box" as const };
		assert.equal(withRedactSize(box, 3), box);
	});
});

describe("withEffect", () => {
	test("shows a blur as its closest strength, keeping the rest", () => {
		const settings = { ...defaultRedactSettings, tool: "brush" as const };
		const shown = withEffect(
			settings,
			{ type: "blur", radius: BLUR_STRENGTHS[2] * 3000 * 0.9 },
			photo,
		);
		assert.deepEqual(shown, { ...settings, effect: "blur", strength: 2 });
	});

	test("shows pixels as their closest strength", () => {
		const shown = withEffect(
			defaultRedactSettings,
			{ type: "pixelate", size: PIXEL_SIZES[1] * 3000 * 1.1 },
			photo,
		);
		assert.deepEqual(shown, {
			...defaultRedactSettings,
			effect: "pixelate",
			strength: 1,
		});
	});

	test("comes back to the same effect", () => {
		for (const effect of [
			{ type: "solid", color: "#FFD60A" },
			{ type: "blur", radius: BLUR_STRENGTHS[0] * 3000 },
			{ type: "pixelate", size: PIXEL_SIZES[2] * 3000 },
		] as const) {
			const shown = withEffect(defaultRedactSettings, effect, photo);
			assert.deepEqual(redactionEffect(shown, photo), effect);
		}
	});
});

describe("sameEffect", () => {
	test("ignores what's painted with, and the other effect's settings", () => {
		const solid = defaultRedactSettings;
		assert.ok(sameEffect(solid, { ...solid, tool: "brush", strength: 0 }));
		assert.ok(!sameEffect(solid, { ...solid, color: "#FFFFFF" }));
		assert.ok(!sameEffect(solid, { ...solid, effect: "blur" }));
		const blur = { ...solid, effect: "blur" as const };
		assert.ok(sameEffect(blur, { ...blur, color: "#FFFFFF" }));
		assert.ok(!sameEffect(blur, { ...blur, strength: 2 }));
		assert.ok(!sameEffect(blur, { ...blur, effect: "pixelate" }));
	});
});

describe("parseRedactSettings", () => {
	test("reads back settings saved as they are", () => {
		const settings = {
			tool: "brush" as const,
			effect: "blur" as const,
			color: "#6B2FA0",
			strength: 2,
			brushSize: 4,
			eraserSize: 0,
		};
		assert.deepEqual(
			parseRedactSettings(JSON.parse(JSON.stringify(settings))),
			settings,
		);
	});

	test("is the default when nothing, or nothing like settings, was saved", () => {
		for (const saved of [undefined, null, "blur", 3, []]) {
			assert.deepEqual(parseRedactSettings(saved), defaultRedactSettings);
		}
	});

	test("replaces only what isn't valid with the default's", () => {
		assert.deepEqual(
			parseRedactSettings({
				tool: "lasso",
				effect: "mosaic",
				color: "red",
				strength: BLUR_STRENGTHS.length,
				brushSize: 1.5,
				eraserSize: 3,
			}),
			{ ...defaultRedactSettings, eraserSize: 3 },
		);
	});
});

describe("stepRedactSize", () => {
	test("steps the brush or eraser, and leaves a box alone", () => {
		const brush = { ...defaultRedactSettings, tool: "brush" as const };
		assert.equal(stepRedactSize(brush, 1).brushSize, brush.brushSize + 1);
		assert.equal(
			stepRedactSize(defaultRedactSettings, 1),
			defaultRedactSettings,
		);
	});
});
