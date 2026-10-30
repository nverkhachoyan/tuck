/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	CUT_BRUSH_SIZES,
	cutBrush,
	cutCanvasTool,
	cutSizeIndex,
	cutToolInUse,
	defaultCutSettings,
	isCutBrush,
	parseCutSettings,
	stepCutSize,
	withCutSize,
} from "../cutSettings.ts";

describe("parseCutSettings", () => {
	test("reads back what was saved", () => {
		const settings = {
			tool: "subtract",
			addSize: 0,
			subtractSize: 4,
			soft: false,
		} as const;
		assert.deepEqual(parseCutSettings(settings), settings);
	});

	test("takes the default for anything that isn't valid", () => {
		assert.deepEqual(parseCutSettings(null), defaultCutSettings);
		assert.deepEqual(parseCutSettings("tap"), defaultCutSettings);
		assert.deepEqual(
			parseCutSettings({
				tool: "lasso",
				addSize: 1.5,
				subtractSize: 99,
				soft: "yes",
			}),
			defaultCutSettings,
		);
	});

	test("reads Cut out's names for the sub-tools and their sizes", () => {
		assert.deepEqual(
			parseCutSettings({
				tool: "erase",
				keepSize: 0,
				eraseSize: 4,
				soft: false,
			}),
			{ tool: "subtract", addSize: 0, subtractSize: 4, soft: false },
		);
		assert.equal(parseCutSettings({ tool: "pick" }).tool, "tap");
		assert.equal(parseCutSettings({ tool: "keep" }).tool, "add");
	});
});

describe("cutToolInUse", () => {
	test("erases in place of picking where subjects can't be found", () => {
		const picking = { ...defaultCutSettings, tool: "tap" } as const;
		assert.equal(cutToolInUse(picking, true), "tap");
		assert.equal(cutToolInUse(picking, false), "subtract");
		const keeping = { ...defaultCutSettings, tool: "add" } as const;
		assert.equal(cutToolInUse(keeping, false), "add");
	});
});

describe("isCutBrush", () => {
	test("is a brush exactly where there's one to paint with", () => {
		const size = { width: 100, height: 100 };
		for (const tool of ["tap", "add", "subtract"] as const) {
			assert.equal(
				isCutBrush(tool),
				cutBrush(defaultCutSettings, tool, size) !== null,
				tool,
			);
		}
	});
});

describe("cutSizeIndex", () => {
	const settings = { ...defaultCutSettings, addSize: 0, subtractSize: 4 };

	test("is each brush's own size", () => {
		assert.equal(cutSizeIndex(settings, "add"), 0);
		assert.equal(cutSizeIndex(settings, "subtract"), 4);
	});

	test("is none for picking", () => {
		assert.equal(cutSizeIndex(settings, "tap"), null);
	});

	test("reads the eraser's size when it stands in for a saved Tap", () => {
		const picking = { ...settings, tool: "tap" as const };
		assert.equal(cutSizeIndex(picking, cutToolInUse(picking, false)), 4);
	});
});

describe("withCutSize", () => {
	const settings = { ...defaultCutSettings, addSize: 0, subtractSize: 4 };

	test("changes only the size of the brush it's given", () => {
		assert.deepEqual(withCutSize(settings, "add", 3), {
			...settings,
			addSize: 3,
		});
		assert.deepEqual(withCutSize(settings, "subtract", 1), {
			...settings,
			subtractSize: 1,
		});
	});

	test("leaves the settings as they are for picking", () => {
		assert.equal(withCutSize(settings, "tap", 3), settings);
	});

	test("writes the eraser's size when it stands in for a saved Tap", () => {
		const picking = { ...settings, tool: "tap" as const };
		assert.deepEqual(withCutSize(picking, cutToolInUse(picking, false), 1), {
			...picking,
			subtractSize: 1,
		});
	});
});

describe("cutBrush", () => {
	const size = { width: 4000, height: 3000 };

	test("adds with a pen and subtracts with an eraser, each its own size", () => {
		const settings = {
			tool: "add",
			addSize: 0,
			subtractSize: 4,
			soft: false,
		} as const;
		assert.deepEqual(cutBrush(settings, "add", size), {
			type: "pen",
			width: CUT_BRUSH_SIZES[0] * 3000,
		});
		assert.deepEqual(cutBrush(settings, "subtract", size), {
			type: "eraser",
			width: CUT_BRUSH_SIZES[4] * 3000,
		});
	});

	test("feathers a soft brush's edge in proportion to its width", () => {
		const brush = cutBrush(defaultCutSettings, "subtract", size);
		const width = CUT_BRUSH_SIZES[defaultCutSettings.subtractSize] * 3000;
		assert.equal(brush?.width, width);
		assert.ok(brush?.feather !== undefined);
		assert.ok(brush.feather > 0 && brush.feather < width / 4);
	});

	test("has no brush for picking", () => {
		assert.equal(cutBrush(defaultCutSettings, "tap", size), null);
	});
});

describe("stepCutSize", () => {
	test("steps the brush in use, and leaves Tap alone", () => {
		const keep = { ...defaultCutSettings, tool: "add" as const };
		assert.equal(stepCutSize(keep, "add", 1).addSize, keep.addSize + 1);
		assert.equal(
			stepCutSize(defaultCutSettings, "tap", -1),
			defaultCutSettings,
		);
	});

	test("steps the eraser's size when it stands in for a saved Tap", () => {
		const picking = { ...defaultCutSettings, tool: "tap" as const };
		const stepped = stepCutSize(picking, cutToolInUse(picking, false), 1);
		assert.deepEqual(stepped, {
			...picking,
			subtractSize: picking.subtractSize + 1,
		});
		assert.equal(stepCutSize(picking, "tap", 1), picking);
	});
});

describe("cutCanvasTool", () => {
	const photo = { width: 4000, height: 3000 };

	test("taps to pick a subject with Tap", () => {
		assert.deepEqual(cutCanvasTool("photo", defaultCutSettings, "tap", photo), {
			type: "pickSubject",
			layerId: "photo",
		});
	});

	test("paints the cut with the brushes", () => {
		assert.deepEqual(
			cutCanvasTool("photo", defaultCutSettings, "subtract", photo),
			{
				type: "cutBrush",
				layerId: "photo",
				brush: cutBrush(defaultCutSettings, "subtract", photo),
			},
		);
	});
});
