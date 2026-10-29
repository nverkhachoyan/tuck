/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	type EditorDocument,
} from "../../../document/document.ts";
import type { ShapeLayer } from "../shape.ts";
import { addShape, setShapeStyle } from "../shapeEdits.ts";

const blank = () => createBlankDocument(400, 300, "#ffffff");
const style = { color: "#0000ff", strokeWidth: 4 };
const place = { x: 200, y: 150, rotation: 0, width: 100, height: 60 };

const top = <T>(document: EditorDocument) => document.layers.at(-1) as T;

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
