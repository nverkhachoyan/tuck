/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	type EditorDocument,
} from "../../document.ts";
import type { ImageLayer } from "../image.ts";
import { duplicateLayer, reorderLayer, resizeLayerBox } from "../layer.ts";
import { createRedactionBox } from "../redaction.ts";
import { createShapeLayer, type ShapeLayer } from "../shape.ts";
import { createTextLayer } from "../text.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

const style = { color: "#FF3B30", strokeWidth: 12 };
const rectangle = () =>
	createShapeLayer(
		"rectangle",
		{ x: 500, y: 300, rotation: 0, width: 200, height: 100 },
		style,
	);
const arrow = () =>
	createShapeLayer(
		"arrow",
		{ x: 500, y: 300, rotation: Math.PI / 4, width: 400, height: 0 },
		style,
	);

describe("duplicateLayer", () => {
	test("copies text with a new id, nudged by half a scaled line", () => {
		const original = {
			...createTextLayer(landscape(), "copy me", { align: "right" }),
			transform: { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 0.3 },
		};
		const copy = duplicateLayer(original);
		const offset = original.fontSize * 2 * 0.5;

		assert.notEqual(copy.id, original.id);
		assert.deepEqual(
			{ ...copy, id: original.id },
			{
				...original,
				transform: { ...original.transform, x: 100 + offset, y: 200 + offset },
			},
		);
	});
	test("copies an image with a new id, nudged by a tenth of its scaled size", () => {
		const original: ImageLayer = {
			type: "image",
			id: "sticker",
			uri: "file:///sticker.png",
			width: 400,
			height: 200,
			opaque: false,
			transform: { x: 100, y: 200, scaleX: 3, scaleY: 3, rotation: 0 },
			hidden: false,
			locked: false,
			flipped: false,
		};
		const copy = duplicateLayer(original);
		assert.notEqual(copy.id, original.id);
		assert.equal(copy.uri, original.uri);
		assert.equal(copy.transform.x, 100 + 60);
		assert.equal(copy.transform.y, 200 + 60);
	});

	test("copies a shape, nudged by a tenth of its box or its length", () => {
		const box = duplicateLayer(rectangle());
		assert.equal(box.transform.x, 500 + 10);
		const line = duplicateLayer(arrow());
		assert.equal(line.transform.y, 300 + 40);
	});
});

describe("resizeLayerBox", () => {
	const moved = { x: 520, y: 300, scaleX: 1, scaleY: 1, rotation: 0 };

	test("resizes a box shape or a redaction's box, and moves it", () => {
		const shape = resizeLayerBox(rectangle(), moved, 240, 80) as ShapeLayer;
		assert.deepEqual(shape.transform, moved);
		assert.equal(shape.shape === "rectangle" && shape.width, 240);
		const redaction = createRedactionBox(
			{ x: 0, y: 0, width: 10, height: 10 },
			{ type: "solid", color: "#000000" },
		);
		assert.equal(
			resizeLayerBox(redaction, moved, 30, 20)?.transform.x,
			moved.x,
		);
	});

	test("takes a line's width as its length, and turns it", () => {
		const turned = { ...moved, rotation: 1 };
		const line = resizeLayerBox(arrow(), turned, 250, 30) as ShapeLayer;
		assert.equal(line.shape === "arrow" && line.length, 250);
		assert.equal(line.transform.rotation, 1);
	});

	test("is null for no change, an empty box, or a layer without a box", () => {
		const shape = rectangle();
		assert.equal(resizeLayerBox(shape, shape.transform, 200, 100), null);
		assert.equal(resizeLayerBox(shape, moved, 0, 100), null);
		const text = createTextLayer(landscape(), "text");
		assert.equal(resizeLayerBox(text, moved, 200, 100), null);
	});
});

describe("reorderLayer", () => {
	// The photo plus text layers named a, b, c, bottom to top.
	const stack = (): EditorDocument["layers"] => {
		const document = landscape();
		return [
			...document.layers,
			...["a", "b", "c"].map((id) => ({
				...createTextLayer(document, id),
				id,
			})),
		];
	};
	const ids = (layers: EditorDocument["layers"]) =>
		layers.map((layer) => layer.id);

	test("moves a layer up or down the stack", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "a", 3)), [
			"photo",
			"b",
			"c",
			"a",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "c", 1)), [
			"photo",
			"c",
			"a",
			"b",
		]);
	});

	test("moves the photo like any layer", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "b", 0)), [
			"b",
			"photo",
			"a",
			"c",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "photo", 2)), [
			"a",
			"b",
			"photo",
			"c",
		]);
	});

	test("clamps past either end", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "c", -5)), [
			"c",
			"photo",
			"a",
			"b",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "a", 99)), [
			"photo",
			"b",
			"c",
			"a",
		]);
	});

	test("returns the same array when nothing moves", () => {
		const layers = stack();
		assert.equal(reorderLayer(layers, "b", 2), layers);
		assert.equal(reorderLayer(layers, "missing", 1), layers);
	});

	test("never mutates the input", () => {
		const layers = stack();
		const before = [...layers];
		reorderLayer(layers, "a", 3);
		assert.deepEqual(layers, before);
	});
});
