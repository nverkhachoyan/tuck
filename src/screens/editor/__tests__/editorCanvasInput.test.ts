/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canvasInputFor, canvasToolFor } from "../editorCanvasInput.ts";
import type { DialDrag } from "../shell/dialDrag.ts";
import { defaultCutOutSettings } from "../tools/cutout/cutOutSettings.ts";
import {
	brushFor,
	defaultBrushSettings,
	shapeStyleFor,
} from "../tools/draw/brushSettings.ts";
import {
	defaultRedactSettings,
	maskBrush,
	redactionEffect,
} from "../tools/redact/redactSettings.ts";

const size = { width: 4000, height: 3000 };
const base = {
	eyedropper: false,
	tool: null,
	cut: null,
	draw: defaultBrushSettings,
	redact: defaultRedactSettings,
	size,
};
const cut = { layerId: "photo", settings: defaultCutOutSettings };

describe("canvasToolFor", () => {
	test("leaves the canvas to selecting with no tool", () => {
		assert.equal(canvasToolFor(base), null);
	});

	test("picks a color over any tool", () => {
		assert.deepEqual(
			canvasToolFor({
				...base,
				eyedropper: true,
				tool: "cutOut",
				cut: { ...cut, tool: "keep" },
			}),
			{ type: "pickColor" },
		);
		assert.deepEqual(
			canvasToolFor({ ...base, eyedropper: true, tool: "draw" }),
			{ type: "pickColor" },
		);
	});

	test("taps to pick a subject with Cut out's Pick", () => {
		assert.deepEqual(
			canvasToolFor({ ...base, tool: "cutOut", cut: { ...cut, tool: "pick" } }),
			{ type: "pickSubject", layerId: "photo" },
		);
	});

	test("paints the cut with Cut out's brushes", () => {
		const tool = canvasToolFor({
			...base,
			tool: "cutOut",
			cut: { ...cut, tool: "erase" },
		});
		assert.equal(tool?.type, "cutBrush");
		assert.equal(tool?.type === "cutBrush" && tool.layerId, "photo");
		assert.equal(tool?.type === "cutBrush" && tool.brush.type, "eraser");
	});

	test("draws with Draw's brush, or drags out its shape", () => {
		assert.deepEqual(canvasToolFor({ ...base, tool: "draw" }), {
			type: "draw",
			brush: brushFor(defaultBrushSettings, size),
		});
		const shapes = { ...defaultBrushSettings, tool: "shape" as const };
		assert.deepEqual(canvasToolFor({ ...base, tool: "draw", draw: shapes }), {
			type: "drawShape",
			shape: shapes.shape,
			style: shapeStyleFor(shapes, size),
		});
	});

	test("drags out Redact's box, or paints with its brush", () => {
		const boxes = { ...defaultRedactSettings, tool: "box" as const };
		assert.deepEqual(
			canvasToolFor({ ...base, tool: "redact", redact: boxes }),
			{
				type: "redactBox",
				effect: redactionEffect(boxes, size),
			},
		);
		const brushes = { ...defaultRedactSettings, tool: "brush" as const };
		assert.deepEqual(
			canvasToolFor({ ...base, tool: "redact", redact: brushes }),
			{
				type: "redactBrush",
				brush: maskBrush(brushes, size),
				effect: redactionEffect(brushes, size),
			},
		);
	});

	test("leaves Find and Adjust's canvas to their own input", () => {
		assert.equal(canvasToolFor({ ...base, tool: "find" }), null);
		assert.equal(canvasToolFor({ ...base, tool: "adjust" }), null);
	});
});

describe("canvasInputFor", () => {
	const adjustDrag = { value: 0 } as unknown as DialDrag;
	const find = { imageId: "photo", onToggle: () => {} };
	const inputs = {
		canvasTool: null,
		tool: null,
		find: null,
		adjustDrag,
		editingText: false,
	};

	test("selects with nothing else going on", () => {
		assert.deepEqual(canvasInputFor(inputs), { type: "select" });
	});

	test("gives the canvas tool its drags first", () => {
		assert.deepEqual(
			canvasInputFor({
				...inputs,
				canvasTool: { type: "pickColor" },
				tool: "find",
				find,
				editingText: true,
			}),
			{ type: "tool", tool: { type: "pickColor" } },
		);
	});

	test("toggles what Find found only while it has an image", () => {
		assert.deepEqual(canvasInputFor({ ...inputs, tool: "find", find }), {
			type: "find",
			...find,
		});
		assert.deepEqual(canvasInputFor({ ...inputs, tool: "find" }), {
			type: "select",
		});
	});

	test("turns Adjust's dial", () => {
		assert.deepEqual(canvasInputFor({ ...inputs, tool: "adjust" }), {
			type: "adjust",
			drag: adjustDrag,
		});
	});

	test("edits the text being typed", () => {
		assert.deepEqual(canvasInputFor({ ...inputs, editingText: true }), {
			type: "editText",
		});
	});
});
