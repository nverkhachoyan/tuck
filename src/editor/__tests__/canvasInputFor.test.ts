/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CanvasTool } from "../canvas/canvasTool.ts";
import {
	type CanvasInput,
	canvasInputFor,
	inputRules,
	type LiveAdjustment,
	outlinedLayerFor,
} from "../canvasInputFor.ts";
import { createDrawingLayer } from "../layers/drawing/drawing.ts";
import { createImageLayer } from "../layers/image/image.ts";
import type { Layer } from "../layers/layer.ts";
import { createRedactionBox } from "../layers/redaction/redaction.ts";
import { createShapeLayer } from "../layers/shape/shape.ts";
import type { DialDrag } from "../shell/dialDrag.ts";

describe("canvasInputFor", () => {
	const toolInput: CanvasInput = {
		type: "dial",
		drag: {} as DialDrag,
		adjusting: null,
	};
	const inputs = { eyedropper: false, toolInput: null };

	test("selects with nothing else going on", () => {
		assert.deepEqual(canvasInputFor(inputs), { type: "select" });
	});

	test("picks a color over the tool's input", () => {
		assert.deepEqual(canvasInputFor({ eyedropper: true, toolInput }), {
			type: "tool",
			tool: { type: "pickColor" },
		});
	});

	test("gives the tool's input over selecting", () => {
		assert.equal(canvasInputFor({ ...inputs, toolInput }), toolInput);
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
const dial: CanvasInput = {
	type: "dial",
	drag: {} as DialDrag,
	adjusting: null,
};
const adjusting = (layerId: string): CanvasInput => ({
	...dial,
	adjusting: { layerId, matrix: {} as LiveAdjustment["matrix"] },
});
const regions: CanvasInput = {
	type: "regions",
	imageId: "photo",
	regions: [],
	onToggle: () => {},
};
const editText = (layer: Layer): CanvasInput => ({
	type: "editText",
	layer,
	text: "",
	indexAt: () => null,
	onSelect: () => {},
	onDone: () => {},
});

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
		assert.deepEqual(inputRules(editText(drawing), true), {
			selection: "still",
			oneFinger: null,
			cursor: "hover",
		});
	});

	test("toggling regions pans with one finger anywhere", () => {
		assert.deepEqual(inputRules(regions, false), {
			selection: "still",
			oneFinger: "anywhere",
			cursor: "pointer",
		});
	});

	test("turning a dial keeps one finger for it, zoomed or not", () => {
		for (const zoomed of [false, true]) {
			assert.deepEqual(inputRules(dial, zoomed), {
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
	const none = { layers: [photo, other], selectedLayer: undefined };

	test("cutting out or adjusting outlines the image, when there's another", () => {
		const cut: CanvasInput = { type: "tool", tool: cutBrush };
		assert.equal(outlinedLayerFor(cut, none), photo);
		assert.equal(outlinedLayerFor(cut, { ...none, layers: [photo] }), null);
		assert.equal(outlinedLayerFor(adjusting("other"), none), other);
		assert.equal(
			outlinedLayerFor(adjusting("photo"), {
				...none,
				layers: [photo, drawing],
			}),
			null,
		);
		assert.equal(outlinedLayerFor(dial, none), null);
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
		assert.equal(outlinedLayerFor(editText(drawing), none), drawing);
		assert.equal(outlinedLayerFor({ type: "select" }, none), null);
		assert.equal(outlinedLayerFor(regions, none), null);
	});
});
