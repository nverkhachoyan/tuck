/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type CanvasInput, inputRules } from "./canvasInput.ts";

const pen: CanvasInput = {
	type: "tool",
	tool: { type: "draw", brush: { type: "pen", color: "#FF3B30", width: 10 } },
};
const pick: CanvasInput = { type: "tool", tool: { type: "pickColor" } };
const find: CanvasInput = {
	type: "find",
	imageId: "photo",
	onToggle: () => {},
};

describe("inputRules", () => {
	test("selecting moves the selection, and one finger pans only when zoomed", () => {
		assert.deepEqual(inputRules({ type: "select" }, false), {
			holdsStill: false,
			oneFinger: null,
			cursor: "hover",
		});
		assert.equal(
			inputRules({ type: "select" }, true).oneFinger,
			"offSelection",
		);
	});

	test("a tool, picking a color too, keeps one finger and a crosshair", () => {
		for (const input of [pen, pick]) {
			for (const zoomed of [false, true]) {
				assert.deepEqual(inputRules(input, zoomed), {
					holdsStill: true,
					oneFinger: null,
					cursor: "crosshair",
				});
			}
		}
	});

	test("editing text keeps one finger, and the cursor follows the text", () => {
		assert.deepEqual(inputRules({ type: "editText" }, true), {
			holdsStill: true,
			oneFinger: null,
			cursor: "hover",
		});
	});

	test("finding and adjusting pan with one finger anywhere", () => {
		assert.deepEqual(inputRules(find, false), {
			holdsStill: true,
			oneFinger: "anywhere",
			cursor: "pointer",
		});
		assert.equal(inputRules({ type: "adjust" }, false).oneFinger, "anywhere");
	});

	test("adjusting shows a grab cursor only when zoomed", () => {
		assert.equal(inputRules({ type: "adjust" }, false).cursor, "default");
		assert.equal(inputRules({ type: "adjust" }, true).cursor, "grab");
	});
});
