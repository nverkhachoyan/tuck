/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	CUT_BRUSH_SIZES,
	cutBrush,
	cutCanvasTool,
	cutSizeIndex,
	cutToolInUse,
	defaultCutOutSettings,
	isCutBrush,
	parseCutOutSettings,
	stepCutSize,
	withCutSize,
} from "../cutOutSettings.ts";

describe("parseCutOutSettings", () => {
	test("reads back what was saved", () => {
		const settings = {
			tool: "erase",
			keepSize: 0,
			eraseSize: 4,
			soft: false,
		} as const;
		assert.deepEqual(parseCutOutSettings(settings), settings);
	});

	test("takes the default for anything that isn't valid", () => {
		assert.deepEqual(parseCutOutSettings(null), defaultCutOutSettings);
		assert.deepEqual(parseCutOutSettings("pick"), defaultCutOutSettings);
		assert.deepEqual(
			parseCutOutSettings({
				tool: "lasso",
				keepSize: 1.5,
				eraseSize: 99,
				soft: "yes",
			}),
			defaultCutOutSettings,
		);
	});
});

describe("cutToolInUse", () => {
	test("erases in place of picking where subjects can't be found", () => {
		const picking = { ...defaultCutOutSettings, tool: "pick" } as const;
		assert.equal(cutToolInUse(picking, true), "pick");
		assert.equal(cutToolInUse(picking, false), "erase");
		const keeping = { ...defaultCutOutSettings, tool: "keep" } as const;
		assert.equal(cutToolInUse(keeping, false), "keep");
	});
});

describe("isCutBrush", () => {
	test("is a brush exactly where there's one to paint with", () => {
		const size = { width: 100, height: 100 };
		for (const tool of ["pick", "keep", "erase"] as const) {
			assert.equal(
				isCutBrush(tool),
				cutBrush(defaultCutOutSettings, tool, size) !== null,
				tool,
			);
		}
	});
});

describe("cutSizeIndex", () => {
	const settings = { ...defaultCutOutSettings, keepSize: 0, eraseSize: 4 };

	test("is each brush's own size", () => {
		assert.equal(cutSizeIndex(settings, "keep"), 0);
		assert.equal(cutSizeIndex(settings, "erase"), 4);
	});

	test("is none for picking", () => {
		assert.equal(cutSizeIndex(settings, "pick"), null);
	});

	test("reads the eraser's size when it stands in for a saved Pick", () => {
		const picking = { ...settings, tool: "pick" as const };
		assert.equal(cutSizeIndex(picking, cutToolInUse(picking, false)), 4);
	});
});

describe("withCutSize", () => {
	const settings = { ...defaultCutOutSettings, keepSize: 0, eraseSize: 4 };

	test("changes only the size of the brush it's given", () => {
		assert.deepEqual(withCutSize(settings, "keep", 3), {
			...settings,
			keepSize: 3,
		});
		assert.deepEqual(withCutSize(settings, "erase", 1), {
			...settings,
			eraseSize: 1,
		});
	});

	test("leaves the settings as they are for picking", () => {
		assert.equal(withCutSize(settings, "pick", 3), settings);
	});

	test("writes the eraser's size when it stands in for a saved Pick", () => {
		const picking = { ...settings, tool: "pick" as const };
		assert.deepEqual(withCutSize(picking, cutToolInUse(picking, false), 1), {
			...picking,
			eraseSize: 1,
		});
	});
});

describe("cutBrush", () => {
	const size = { width: 4000, height: 3000 };

	test("keeps with a pen and erases with an eraser, each its own size", () => {
		const settings = {
			tool: "keep",
			keepSize: 0,
			eraseSize: 4,
			soft: false,
		} as const;
		assert.deepEqual(cutBrush(settings, "keep", size), {
			type: "pen",
			width: CUT_BRUSH_SIZES[0] * 3000,
		});
		assert.deepEqual(cutBrush(settings, "erase", size), {
			type: "eraser",
			width: CUT_BRUSH_SIZES[4] * 3000,
		});
	});

	test("feathers a soft brush's edge in proportion to its width", () => {
		const brush = cutBrush(defaultCutOutSettings, "erase", size);
		const width = CUT_BRUSH_SIZES[defaultCutOutSettings.eraseSize] * 3000;
		assert.equal(brush?.width, width);
		assert.ok(brush?.feather !== undefined);
		assert.ok(brush.feather > 0 && brush.feather < width / 4);
	});

	test("has no brush for picking", () => {
		assert.equal(cutBrush(defaultCutOutSettings, "pick", size), null);
	});
});

describe("stepCutSize", () => {
	test("steps the brush in use, and leaves Pick alone", () => {
		const keep = { ...defaultCutOutSettings, tool: "keep" as const };
		assert.equal(stepCutSize(keep, "keep", 1).keepSize, keep.keepSize + 1);
		assert.equal(
			stepCutSize(defaultCutOutSettings, "pick", -1),
			defaultCutOutSettings,
		);
	});

	test("steps the eraser's size when it stands in for a saved Pick", () => {
		const picking = { ...defaultCutOutSettings, tool: "pick" as const };
		const stepped = stepCutSize(picking, cutToolInUse(picking, false), 1);
		assert.deepEqual(stepped, {
			...picking,
			eraseSize: picking.eraseSize + 1,
		});
		assert.equal(stepCutSize(picking, "pick", 1), picking);
	});
});

describe("cutCanvasTool", () => {
	const photo = { width: 4000, height: 3000 };

	test("taps to pick a subject with Pick", () => {
		assert.deepEqual(
			cutCanvasTool("photo", defaultCutOutSettings, "pick", photo),
			{ type: "pickSubject", layerId: "photo" },
		);
	});

	test("paints the cut with the brushes", () => {
		assert.deepEqual(
			cutCanvasTool("photo", defaultCutOutSettings, "erase", photo),
			{
				type: "cutBrush",
				layerId: "photo",
				brush: cutBrush(defaultCutOutSettings, "erase", photo),
			},
		);
	});
});
