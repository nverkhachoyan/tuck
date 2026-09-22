/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	createTextLayer,
	defaultTextStyle,
	duplicateTextLayer,
	type EditorDocument,
	initialFontSize,
	reorderLayer,
} from "./document.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000);

describe("createDocumentFromImage", () => {
	test("is sized to the photo, with the photo as its only layer", () => {
		const document = landscape();
		assert.equal(document.width, 4000);
		assert.equal(document.height, 3000);
		assert.equal(document.layers.length, 1);
		assert.equal(document.layers[0].type, "image");
		assert.equal(document.layers[0].hidden, false);
	});
});

describe("initialFontSize", () => {
	test("scales with the photo's shorter side", () => {
		const small = initialFontSize(createDocumentFromImage("a", 1000, 2000));
		const large = initialFontSize(createDocumentFromImage("b", 4000, 3000));
		assert.equal(large / small, 3);
	});
});

describe("createTextLayer", () => {
	test("starts centered, in the meme style, wrapping at 90% width", () => {
		const document = landscape();
		const layer = createTextLayer(document, "hello", "left");
		assert.equal(layer.transform.x, 2000);
		assert.equal(layer.transform.y, 1500);
		assert.equal(layer.color, defaultTextStyle.color);
		assert.equal(layer.outlineColor, defaultTextStyle.outlineColor);
		assert.equal(layer.align, "left");
		assert.equal(layer.maxWidth, 3600);
		assert.equal(layer.hidden, false);
	});

	test("gives every layer a unique id", () => {
		const document = landscape();
		const ids = new Set(
			Array.from(
				{ length: 50 },
				() => createTextLayer(document, "x", "center").id,
			),
		);
		assert.equal(ids.size, 50);
	});
});

describe("duplicateTextLayer", () => {
	test("copies everything but the id, nudged by half a scaled line", () => {
		const original = {
			...createTextLayer(landscape(), "copy me", "right"),
			transform: { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 0.3 },
		};
		const copy = duplicateTextLayer(original);
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
});

describe("reorderLayer", () => {
	// The photo plus text layers named a, b, c, bottom to top.
	const stack = (): EditorDocument["layers"] => {
		const document = landscape();
		return [
			...document.layers,
			...["a", "b", "c"].map((id) => ({
				...createTextLayer(document, id, "center"),
				id,
			})),
		];
	};
	const ids = (layers: EditorDocument["layers"]) =>
		layers.map((layer) => layer.id);

	test("moves a layer up or down the stack", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "a", 3)), [
			"background",
			"b",
			"c",
			"a",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "c", 1)), [
			"background",
			"c",
			"a",
			"b",
		]);
	});

	test("keeps the photo at the bottom", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "b", 0)), [
			"background",
			"b",
			"a",
			"c",
		]);
		const layers = stack();
		assert.equal(reorderLayer(layers, "background", 2), layers);
	});

	test("clamps past the top", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "a", 99)), [
			"background",
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
