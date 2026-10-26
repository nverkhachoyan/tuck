/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../../model/layers/drawing.ts";
import { createImageLayer } from "../../../model/layers/image.ts";
import { createRedactionBox } from "../../../model/layers/redaction.ts";
import { createShapeLayer } from "../../../model/layers/shape.ts";
import type { CanvasTool } from "../canvas/canvasTool.ts";
import {
	type CanvasInput,
	canvasInputFor,
	canvasToolFor,
	inputRules,
	outlinedLayerFor,
} from "../canvasInputFor.ts";
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
	const found = { imageId: "photo", onToggle: () => {} };
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
				find: found,
				editingText: true,
			}),
			{ type: "tool", tool: { type: "pickColor" } },
		);
	});

	test("toggles what Find found only while it has an image", () => {
		assert.deepEqual(canvasInputFor({ ...inputs, tool: "find", find: found }), {
			type: "find",
			...found,
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
const cutBrush: CanvasTool = {
	type: "cutBrush",
	layerId: "photo",
	brush: { type: "pen", width: 20 },
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

describe("outlinedLayerFor", () => {
	const canvas = { width: 100, height: 100 };
	const photo = {
		...createImageLayer(canvas, "photo.jpg", 100, 100, true),
		id: "photo",
	};
	const other = {
		...createImageLayer(canvas, "other.jpg", 100, 100, true),
		id: "other",
	};
	const none = {
		layers: [photo, other],
		selectedLayer: undefined,
		editedLayer: null,
		adjustedId: undefined,
	};

	test("cutting out or adjusting outlines the image, when there's another", () => {
		const cut: CanvasInput = { type: "tool", tool: cutBrush };
		assert.equal(outlinedLayerFor(cut, none), photo);
		assert.equal(outlinedLayerFor(cut, { ...none, layers: [photo] }), null);
		assert.equal(
			outlinedLayerFor(adjust, { ...none, adjustedId: "other" }),
			other,
		);
		assert.equal(
			outlinedLayerFor(adjust, {
				...none,
				layers: [photo, drawing],
				adjustedId: "photo",
			}),
			null,
		);
		assert.equal(outlinedLayerFor(adjust, none), null);
	});

	test("a tool outlines the layer whose style it changes, unless that layer drags", () => {
		assert.equal(
			outlinedLayerFor(redactBrush, { ...none, selectedLayer: redaction }),
			redaction,
		);
		assert.equal(
			outlinedLayerFor(redactBox, { ...none, selectedLayer: redaction }),
			null,
		);
		// Locked, it doesn't drag, so it has no handles to show it.
		const locked = { ...redaction, locked: true };
		assert.equal(
			outlinedLayerFor(redactBox, { ...none, selectedLayer: locked }),
			locked,
		);
		assert.equal(
			outlinedLayerFor(pen, { ...none, selectedLayer: drawing }),
			null,
		);
	});

	test("editing text outlines the text, and selecting outlines nothing", () => {
		assert.equal(
			outlinedLayerFor({ type: "editText" }, { ...none, editedLayer: drawing }),
			drawing,
		);
		assert.equal(outlinedLayerFor({ type: "select" }, none), null);
		assert.equal(outlinedLayerFor(find, none), null);
	});
});
