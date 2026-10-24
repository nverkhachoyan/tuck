/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { editorFrame } from "../editorFrame.ts";

describe("editorFrame", () => {
	test("a phone keeps the dock", () => {
		assert.deepEqual(editorFrame(390, 844), {
			layersBeside: false,
			wide: false,
			inspectorPinned: false,
		});
	});

	test("a medium window puts the layers beside the canvas and keeps the dock", () => {
		assert.deepEqual(editorFrame(900, 800), {
			layersBeside: true,
			wide: false,
			inspectorPinned: false,
		});
	});

	test("a 13-inch laptop gets the rail, with the inspector closed until it's asked for", () => {
		for (const size of [
			[1024, 768],
			[1280, 800],
			[1440, 900],
			[1470, 860],
		] as const) {
			const frame = editorFrame(size[0], size[1]);
			assert.equal(frame.wide, true, `${size[0]}×${size[1]}`);
			assert.equal(frame.inspectorPinned, false, `${size[0]}×${size[1]}`);
		}
	});

	test("a tall window keeps the inspector open", () => {
		// An iPad Pro 13-inch in landscape, and a desktop window.
		for (const size of [
			[1376, 1032],
			[1440, 960],
			[1680, 1050],
		] as const) {
			const frame = editorFrame(size[0], size[1]);
			assert.equal(frame.wide, true, `${size[0]}×${size[1]}`);
			assert.equal(frame.inspectorPinned, true, `${size[0]}×${size[1]}`);
		}
	});
});
