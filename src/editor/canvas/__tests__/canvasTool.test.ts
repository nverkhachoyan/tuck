/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../layers/drawing/drawing.ts";
import {
	createRedactionBox,
	createRedactionStrokes,
} from "../../layers/redaction/redaction.ts";
import { createShapeLayer } from "../../layers/shape/shape.ts";
import {
	type CanvasTool,
	canAddTo,
	cutImageId,
	restyles,
} from "../canvasTool.ts";

const pen: CanvasTool = {
	type: "draw",
	brush: { type: "pen", color: "#FF3B30", width: 10 },
};
const effect = { type: "solid", color: "#000000" } as const;
const style = { color: "#FF3B30", strokeWidth: 8 };
const redactBox: CanvasTool = { type: "redactBox", effect };
const redactBrush: CanvasTool = {
	type: "redactBrush",
	brush: { type: "pen", width: 40 },
	effect,
};
const drawShape: CanvasTool = { type: "drawShape", shape: "rectangle", style };
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
		assert.equal(restyles(redactBox, redaction), true);
		assert.equal(restyles(redactBrush, redaction), true);
		assert.equal(restyles(drawShape, shape), true);
		assert.equal(restyles(redactBox, shape), false);
		assert.equal(restyles(pen, drawing), false);
		assert.equal(restyles(redactBox, undefined), false);
	});
});

describe("canAddTo", () => {
	test("strokes join an unlocked drawing or brushed redaction", () => {
		assert.equal(canAddTo(pen, drawing), true);
		assert.equal(canAddTo(redactBrush, strokes), true);
		assert.equal(canAddTo(pen, { ...drawing, locked: true }), false);
		assert.equal(canAddTo(redactBrush, redaction), false);
		assert.equal(canAddTo(redactBox, redaction), false);
		assert.equal(canAddTo(cutBrush, drawing), false);
		const highlighter: CanvasTool = {
			type: "draw",
			brush: { type: "pen", color: "#FFD60A", width: 40, tip: "marker" },
		};
		const marker: CanvasTool = {
			type: "draw",
			brush: { type: "pen", color: "#FF3B30", width: 40, tip: "ink" },
		};
		const multiplying = { ...drawing, blend: "multiply" as const };
		assert.equal(canAddTo(highlighter, multiplying), true);
		assert.equal(canAddTo(highlighter, drawing), false);
		assert.equal(canAddTo(pen, multiplying), false);
		assert.equal(canAddTo(marker, drawing), true);
		assert.equal(canAddTo(marker, multiplying), false);
	});
});

describe("cutImageId", () => {
	test("a cut names its image, and other tools name none", () => {
		assert.equal(cutImageId(cutBrush), "photo");
		assert.equal(cutImageId(pickSubject), "photo");
		assert.equal(cutImageId(pen), null);
		assert.equal(cutImageId(null), null);
	});
});
