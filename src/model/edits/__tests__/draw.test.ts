/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	type DrawingLayer,
	type EditorDocument,
	type ShapeLayer,
	type Stroke,
} from "../../document.ts";
import { addShape, drawStroke, setShapeStyle } from "../draw.ts";

const blank = () => createBlankDocument(400, 300, "#ffffff");
const pen: Stroke = {
	type: "pen",
	color: "#ff0000",
	width: 8,
	points: [10, 10, 60, 60],
};
const style = { color: "#0000ff", strokeWidth: 4 };
const place = { x: 200, y: 150, rotation: 0, width: 100, height: 60 };

const top = <T>(document: EditorDocument) => document.layers.at(-1) as T;

describe("drawStroke", () => {
	test("starts a drawing on top with a pen", () => {
		const drawing = top<DrawingLayer>(drawStroke(blank(), null, pen));
		assert.equal(drawing.type, "drawing");
		assert.equal(drawing.strokes.length, 1);
	});

	test("joins the selected drawing", () => {
		const first = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(first);
		const next = drawStroke(first, id, {
			type: "eraser",
			width: 20,
			points: [],
		});
		assert.equal(next, first, "an empty stroke changes nothing");
		const joined = drawStroke(first, id, pen);
		assert.equal(joined.layers.length, 1);
		assert.equal(top<DrawingLayer>(joined).strokes.length, 2);
	});

	test("starts a new drawing over a locked one", () => {
		const first = drawStroke(blank(), null, pen);
		const locked = {
			...first,
			layers: [{ ...top<DrawingLayer>(first), locked: true }],
		};
		const next = drawStroke(locked, top<DrawingLayer>(first).id, pen);
		assert.equal(next.layers.length, 2);
	});

	test("an eraser removes each shape it crosses, whole", () => {
		const document = addShape(blank(), "rectangle", place, style);
		const erased = drawStroke(document, null, {
			type: "eraser",
			width: 20,
			points: [150, 120, 150, 180],
		});
		assert.equal(erased.layers.length, 0);
	});

	test("an eraser leaves locked and hidden shapes, and starts nothing", () => {
		const document = addShape(blank(), "rectangle", place, style);
		const shape = top<ShapeLayer>(document);
		const eraser: Stroke = {
			type: "eraser",
			width: 20,
			points: [150, 120, 150, 180],
		};
		for (const flag of ["locked", "hidden"] as const) {
			const kept = { ...document, layers: [{ ...shape, [flag]: true }] };
			assert.equal(drawStroke(kept, null, eraser), kept);
		}
		const missed = drawStroke(document, null, { ...eraser, points: [0, 0] });
		assert.equal(missed, document);
	});
});

describe("addShape", () => {
	test("puts the shape on top", () => {
		const shape = top<ShapeLayer>(addShape(blank(), "ellipse", place, style));
		assert.equal(shape.shape, "ellipse");
		assert.equal(shape.color, "#0000ff");
	});

	test("needs both sides for a box, and a length for a line", () => {
		const document = blank();
		assert.equal(
			addShape(document, "rectangle", { ...place, height: 0 }, style),
			document,
		);
		assert.equal(
			addShape(document, "arrow", { ...place, width: 0 }, style),
			document,
		);
		assert.equal(
			addShape(document, "line", { ...place, height: 0 }, style).layers.length,
			1,
		);
	});
});

describe("setShapeStyle", () => {
	test("restyles the shape, and leaves the document be when it's the same", () => {
		const document = addShape(blank(), "rectangle", place, style);
		const { id } = top<ShapeLayer>(document);
		const next = setShapeStyle(document, id, { color: "#00ff00" });
		assert.equal(top<ShapeLayer>(next).color, "#00ff00");
		assert.equal(setShapeStyle(next, id, { color: "#00ff00" }), next);
		assert.equal(
			setShapeStyle(document, "gone", { color: "#00ff00" }),
			document,
		);
	});
});
