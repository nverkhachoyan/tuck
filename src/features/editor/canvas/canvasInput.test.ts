/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DialDrag } from "../Dial.tsx";
import { type CanvasInput, inputRules } from "./canvasInput.ts";

const pen: CanvasInput = {
	type: "tool",
	tool: { type: "draw", brush: { type: "pen", color: "#FF3B30", width: 10 } },
};
const pick: CanvasInput = { type: "tool", tool: { type: "pickColor" } };
// Only its type matters to the rules.
const adjust: CanvasInput = { type: "adjust", drag: {} as DialDrag };
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

	test("finding pans with one finger anywhere", () => {
		assert.deepEqual(inputRules(find, false), {
			holdsStill: true,
			oneFinger: "anywhere",
			cursor: "pointer",
		});
	});

	test("adjusting keeps one finger for the dial, zoomed or not", () => {
		for (const zoomed of [false, true]) {
			assert.deepEqual(inputRules(adjust, zoomed), {
				holdsStill: true,
				oneFinger: null,
				cursor: "ew-resize",
			});
		}
	});
});
