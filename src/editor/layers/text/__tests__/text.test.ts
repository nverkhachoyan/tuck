/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDocumentFromImage } from "../../../document/document.ts";
import {
	createTextLayer,
	defaultTextStyle,
	initialFontSize,
	TEXT_PLACEHOLDER,
	withPlaceholder,
} from "../text.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

describe("initialFontSize", () => {
	test("scales with the photo's shorter side", () => {
		const small = initialFontSize(
			createDocumentFromImage("a", 1000, 2000, true),
		);
		const large = initialFontSize(
			createDocumentFromImage("b", 4000, 3000, true),
		);
		assert.equal(large / small, 3);
	});
});

describe("placing new text in the part of the photo in view", () => {
	// A quarter of the photo either way, zoomed into near its top-left.
	const area = { x: 400, y: 300, width: 1000, height: 750 };

	test("centers text on it, sized and wrapped to it", () => {
		const layer = createTextLayer(landscape(), "hi", {}, area);
		assert.equal(layer.transform.x, 900);
		assert.equal(layer.transform.y, 675);
		assert.equal(layer.fontSize, initialFontSize(area));
		assert.equal(layer.maxWidth, 900);
	});

	test("never makes text smaller than a pixel", () => {
		assert.equal(initialFontSize({ width: 4, height: 4 }), 1);
	});
});

describe("createTextLayer", () => {
	test("starts centered, in the meme style, wrapping at 90% width", () => {
		const document = landscape();
		const layer = createTextLayer(document, "hello", { align: "left" });
		assert.equal(layer.transform.x, 2000);
		assert.equal(layer.transform.y, 1500);
		assert.equal(layer.font, "classic");
		assert.equal(layer.color, defaultTextStyle.color);
		assert.equal(layer.outlineColor, defaultTextStyle.outlineColor);
		assert.equal(layer.backgroundColor, null);
		assert.equal(layer.align, "left");
		assert.equal(layer.maxWidth, 3600);
		assert.equal(layer.hidden, false);
	});

	test("gives every layer a unique id", () => {
		const document = landscape();
		const ids = new Set(
			Array.from({ length: 50 }, () => createTextLayer(document, "x").id),
		);
		assert.equal(ids.size, 50);
	});
});

describe("withPlaceholder", () => {
	test("fills empty text with the placeholder", () => {
		const layer = { id: "a", text: "" };
		assert.deepEqual(withPlaceholder(layer), {
			id: "a",
			text: TEXT_PLACEHOLDER,
		});
		assert.equal(layer.text, "");
	});

	test("leaves text that has something, and keeps the same layer", () => {
		const layer = { id: "a", text: " " };
		assert.equal(withPlaceholder(layer), layer);
	});
});
