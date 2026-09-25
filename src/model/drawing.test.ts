/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDrawingLayer,
	type DrawingLayer,
	duplicateLayer,
	type Stroke,
} from "./document.ts";
import {
	addStroke,
	drawingBox,
	hitTestDrawing,
	recenterDrawing,
} from "./drawing.ts";
import { type Point, toDocumentSpace } from "./geometry.ts";

const pen = (points: number[], width = 10): Stroke & { type: "pen" } => ({
	type: "pen",
	color: "#FF3B30",
	width,
	points,
});

const eraser = (points: number[], width = 10): Stroke => ({
	type: "eraser",
	width,
	points,
});

// Where each of a stroke's points lands in the document.
function documentPoints(layer: DrawingLayer, index: number): Point[] {
	const { points } = layer.strokes[index];
	const result: Point[] = [];
	for (let i = 0; i < points.length; i += 2) {
		const { x, y } = toDocumentSpace(layer.transform, {
			x: points[i],
			y: points[i + 1],
		});
		result.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
	}
	return result;
}

describe("createDrawingLayer", () => {
	test("centers on what the stroke covers, and draws where it was drawn", () => {
		const layer = createDrawingLayer(pen([100, 200, 300, 200]));
		assert.equal(layer.transform.x, 200);
		assert.equal(layer.transform.y, 200);
		assert.deepEqual(layer.strokes[0].points, [-100, 0, 100, 0]);
		assert.deepEqual(documentPoints(layer, 0), [
			{ x: 100, y: 200 },
			{ x: 300, y: 200 },
		]);
	});

	test("its box reaches the stroke's edge, not just its points", () => {
		const layer = createDrawingLayer(pen([100, 200, 300, 200], 20));
		assert.deepEqual(drawingBox(layer), { halfWidth: 110, halfHeight: 10 });
	});

	test("a single point is a dot", () => {
		const layer = createDrawingLayer(pen([50, 60], 8));
		assert.deepEqual(drawingBox(layer), { halfWidth: 4, halfHeight: 4 });
		assert.ok(hitTestDrawing(layer, { x: 3, y: 0 }, 0));
		assert.ok(!hitTestDrawing(layer, { x: 5, y: 0 }, 0));
	});
});

describe("addStroke", () => {
	test("keeps earlier strokes where they were as the box grows", () => {
		const first = createDrawingLayer(pen([0, 0, 100, 0]));
		const layer = addStroke(first, pen([100, 0, 100, 300]));
		assert.deepEqual(documentPoints(layer, 0), [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
		]);
		assert.deepEqual(documentPoints(layer, 1), [
			{ x: 100, y: 0 },
			{ x: 100, y: 300 },
		]);
		assert.deepEqual(drawingBox(layer), { halfWidth: 55, halfHeight: 155 });
	});

	test("draws where the finger was on a moved, scaled, and turned drawing", () => {
		const drawn = createDrawingLayer(pen([0, 0, 100, 0]));
		const moved: DrawingLayer = {
			...drawn,
			transform: {
				x: 500,
				y: 400,
				scaleX: 2,
				scaleY: 2,
				rotation: Math.PI / 2,
			},
		};
		const layer = addStroke(moved, pen([500, 400, 600, 400], 10));
		assert.deepEqual(documentPoints(layer, 1), [
			{ x: 500, y: 400 },
			{ x: 600, y: 400 },
		]);
		// Drawn at 10 wide on a layer twice the size.
		assert.equal(layer.strokes[1].width, 5);
	});

	test("keeps a pen's tip and color through the move into the layer", () => {
		const drawn = createDrawingLayer(pen([0, 0, 100, 0]));
		const moved = { ...drawn, transform: { ...drawn.transform, x: 300 } };
		const layer = addStroke(moved, {
			...pen([0, 0, 50, 50], 30),
			color: "#34C759",
			tip: "marker",
		});
		assert.deepEqual(
			{ ...layer.strokes[1], points: [] },
			{
				type: "pen",
				color: "#34C759",
				width: 30,
				tip: "marker",
				points: [],
			},
		);
	});

	test("an eraser doesn't move the drawing's middle", () => {
		const drawn = createDrawingLayer(pen([0, 0, 100, 0]));
		const layer = addStroke(drawn, eraser([100, 0, 900, 900], 40));
		assert.deepEqual(layer.transform, drawn.transform);
		assert.equal(layer.strokes[0], drawn.strokes[0]);
		assert.deepEqual(drawingBox(layer), drawingBox(drawn));
	});
});

describe("recenterDrawing", () => {
	test("leaves a drawing that's already centered as it is", () => {
		const layer = createDrawingLayer(pen([0, 0, 100, 50]));
		assert.equal(recenterDrawing(layer), layer);
	});
});

describe("hitTestDrawing", () => {
	// A square outline, 200 across, drawn 10 wide around the origin.
	const square = createDrawingLayer(
		pen([-100, -100, 100, -100, 100, 100, -100, 100, -100, -100]),
	);

	test("hits along the line, within the padding", () => {
		assert.ok(hitTestDrawing(square, { x: 0, y: -100 }, 0));
		assert.ok(hitTestDrawing(square, { x: 0, y: -94 }, 2));
		assert.ok(!hitTestDrawing(square, { x: 0, y: -90 }, 2));
	});

	test("misses inside a shape drawn around something", () => {
		assert.ok(!hitTestDrawing(square, { x: 0, y: 0 }, 14));
	});

	test("ignores what the eraser drew", () => {
		const layer = addStroke(square, eraser([0, 0, 50, 50]));
		assert.ok(!hitTestDrawing(layer, { x: 25, y: 25 }, 0));
	});
});

describe("duplicateLayer", () => {
	test("offsets a drawing by a tenth of its longer side", () => {
		const line = createDrawingLayer(pen([0, 0, 190, 0]));
		const copy = duplicateLayer(line);
		assert.notEqual(copy.id, line.id);
		assert.equal(copy.transform.x - line.transform.x, 20);
		assert.equal(copy.transform.y - line.transform.y, 20);
		assert.equal(copy.strokes, line.strokes);
	});
});
