/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	defaultRedactLook,
	redactionEffect,
} from "../../../shell/redactLook.ts";
import {
	defaultRedactSettings,
	maskBrush,
	parseRedactSettings,
	REDACT_BRUSH_SIZES,
	redactCanvasTool,
	redactSizeIndex,
	stepRedactSize,
	withRedactSize,
} from "../redactSettings.ts";

const photo = { width: 4000, height: 3000 };

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

describe("parseRedactSettings", () => {
	test("reads back settings saved as they are", () => {
		const settings = { tool: "brush" as const, brushSize: 4, eraserSize: 0 };
		assert.deepEqual(
			parseRedactSettings(JSON.parse(JSON.stringify(settings))),
			settings,
		);
	});

	test("leaves out the look an earlier build saved with them", () => {
		const settings = { tool: "brush" as const, brushSize: 4, eraserSize: 0 };
		assert.deepEqual(
			parseRedactSettings({ ...settings, effect: "blur", strength: 2 }),
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

describe("redactCanvasTool", () => {
	test("drags out the box", () => {
		const boxes = {
			...defaultRedactLook,
			...defaultRedactSettings,
			tool: "box" as const,
		};
		assert.deepEqual(redactCanvasTool(boxes, photo), {
			type: "redactBox",
			effect: redactionEffect(boxes, photo),
		});
	});

	test("paints with the brush", () => {
		const brushes = {
			...defaultRedactLook,
			...defaultRedactSettings,
			tool: "brush" as const,
		};
		assert.deepEqual(redactCanvasTool(brushes, photo), {
			type: "redactBrush",
			brush: maskBrush(brushes, photo),
			effect: redactionEffect(brushes, photo),
		});
	});
});
