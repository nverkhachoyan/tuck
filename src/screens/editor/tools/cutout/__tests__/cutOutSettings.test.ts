/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	CUT_BRUSH_SIZES,
	cutBrush,
	cutOutTool,
	defaultCutOutSettings,
	parseCutOutSettings,
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

describe("cutOutTool", () => {
	test("erases in place of picking where subjects can't be found", () => {
		const picking = { ...defaultCutOutSettings, tool: "pick" } as const;
		assert.equal(cutOutTool(picking, true), "pick");
		assert.equal(cutOutTool(picking, false), "erase");
		const keeping = { ...defaultCutOutSettings, tool: "keep" } as const;
		assert.equal(cutOutTool(keeping, false), "keep");
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
