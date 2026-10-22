/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDrawingLayer,
	createRedactionBox,
	createShapeLayer,
} from "../../../../model/document.ts";
import type { DialDrag } from "../../controls/Dial.tsx";
import { type CanvasInput, inputRules } from "../canvasInput.ts";

const pen: CanvasInput = {
	type: "tool",
	tool: { type: "draw", brush: { type: "pen", color: "#FF3B30", width: 10 } },
};
const pick: CanvasInput = { type: "tool", tool: { type: "pickColor" } };
const effect = { type: "solid", color: "#000000" } as const;
const style = { color: "#FF3B30", strokeWidth: 8 };
const redactBox: CanvasInput = {
	type: "tool",
	tool: { type: "redactBox", effect },
};
const redactBrush: CanvasInput = {
	type: "tool",
	tool: { type: "redactBrush", brush: { type: "pen", width: 40 }, effect },
};
const drawShape: CanvasInput = {
	type: "tool",
	tool: { type: "drawShape", shape: "rectangle", style },
};
const redaction = createRedactionBox(
	{ x: 10, y: 10, width: 100, height: 50 },
	effect,
);
const shape = createShapeLayer(
	"rectangle",
	{ x: 50, y: 50, rotation: 0, width: 80, height: 40 },
	style,
);
const drawing = createDrawingLayer({
	type: "pen",
	color: "#FF3B30",
	width: 10,
	points: [0, 0, 20, 20],
});
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
			selection: "transforms",
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
				assert.deepEqual(inputRules(input, zoomed, shape), {
					selection: "still",
					oneFinger: null,
					cursor: "crosshair",
				});
			}
		}
	});

	test("dragging out boxes or shapes drags the selected one of its kind", () => {
		for (const [input, layer] of [
			[redactBox, redaction],
			[drawShape, shape],
		] as const) {
			for (const zoomed of [false, true]) {
				assert.deepEqual(inputRules(input, zoomed, layer), {
					selection: "drags",
					oneFinger: null,
					cursor: "hover",
				});
			}
		}
	});

	test("a tool holds still what it doesn't drag out, or what's locked", () => {
		for (const [input, layer] of [
			[redactBox, shape],
			[redactBox, drawing],
			[drawShape, redaction],
			[redactBrush, redaction],
			[redactBox, { ...redaction, locked: true }],
			[drawShape, undefined],
		] as const) {
			assert.equal(inputRules(input, false, layer).selection, "still");
		}
	});

	test("editing text keeps one finger, and the cursor follows the text", () => {
		assert.deepEqual(inputRules({ type: "editText" }, true), {
			selection: "still",
			oneFinger: null,
			cursor: "hover",
		});
	});

	test("finding pans with one finger anywhere", () => {
		assert.deepEqual(inputRules(find, false), {
			selection: "still",
			oneFinger: "anywhere",
			cursor: "pointer",
		});
	});

	test("adjusting keeps one finger for the dial, zoomed or not", () => {
		for (const zoomed of [false, true]) {
			assert.deepEqual(inputRules(adjust, zoomed), {
				selection: "still",
				oneFinger: null,
				cursor: "ew-resize",
			});
		}
	});
});
