/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../../../model/layers/drawing.ts";
import { createImageLayer } from "../../../../model/layers/image.ts";
import {
	createRedactionBox,
	createRedactionStrokes,
} from "../../../../model/layers/redaction.ts";
import { createShapeLayer } from "../../../../model/layers/shape.ts";
import type { DialDrag } from "../../shell/dialDrag.ts";
import {
	type CanvasInput,
	type CanvasTool,
	canAddTo,
	cutImageId,
	inputRules,
	outlinedLayerFor,
	restyles,
} from "../canvasInput.ts";

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

const strokes = createRedactionStrokes(
	{ type: "pen", width: 40, points: [0, 0, 20, 20] },
	effect,
);
const cutBrush: CanvasTool = {
	type: "cutBrush",
	layerId: "photo",
	brush: { type: "pen", width: 20 },
};
const pickSubject: CanvasTool = { type: "pickSubject", layerId: "photo" };

describe("restyles", () => {
	test("a redaction's or a shape's tool changes that kind of layer", () => {
		assert.equal(restyles(redactBox.tool, redaction), true);
		assert.equal(restyles(redactBrush.tool, redaction), true);
		assert.equal(restyles(drawShape.tool, shape), true);
		assert.equal(restyles(redactBox.tool, shape), false);
		assert.equal(restyles(pen.tool, drawing), false);
		assert.equal(restyles(redactBox.tool, undefined), false);
	});
});

describe("canAddTo", () => {
	test("strokes join an unlocked drawing or brushed redaction", () => {
		assert.equal(canAddTo(pen.tool, drawing), true);
		assert.equal(canAddTo(redactBrush.tool, strokes), true);
		assert.equal(canAddTo(pen.tool, { ...drawing, locked: true }), false);
		assert.equal(canAddTo(redactBrush.tool, redaction), false);
		assert.equal(canAddTo(redactBox.tool, redaction), false);
		assert.equal(canAddTo(cutBrush, drawing), false);
	});
});

describe("cutImageId", () => {
	test("a cut names its image, and other tools name none", () => {
		assert.equal(cutImageId(cutBrush), "photo");
		assert.equal(cutImageId(pickSubject), "photo");
		assert.equal(cutImageId(pen.tool), null);
		assert.equal(cutImageId(null), null);
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
