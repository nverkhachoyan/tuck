/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canvasInputFor, canvasToolFor } from "../canvasInputFor.ts";
import type { DialDrag } from "../shell/dialDrag.ts";
import { defaultCutOutSettings } from "../tools/cutout/cutOutSettings.ts";
import { defaultBrushSettings } from "../tools/draw/brushSettings.ts";
import { defaultRedactSettings } from "../tools/redact/redactSettings.ts";

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

	test("gives Cut out the canvas over Draw", () => {
		assert.equal(
			canvasToolFor({ ...base, tool: "draw", cut: { ...cut, tool: "pick" } })
				?.type,
			"pickSubject",
		);
	});

	test("hands Draw and Redact their own canvas tools", () => {
		assert.equal(canvasToolFor({ ...base, tool: "draw" })?.type, "draw");
		assert.equal(canvasToolFor({ ...base, tool: "redact" })?.type, "redactBox");
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
