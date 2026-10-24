/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	type EditorDocument,
	type TextLayer,
} from "../../document.ts";
import { addTextLayer, updateTextLayer } from "../text.ts";

const blank = () => createBlankDocument(400, 300, "#ffffff");
const top = (document: EditorDocument) => document.layers.at(-1) as TextLayer;

describe("addTextLayer", () => {
	test("puts the text on top, in its style", () => {
		const document = addTextLayer(
			addTextLayer(blank(), "First"),
			"Second",
			{ color: "#ff0000" },
			{ x: 0, y: 0, width: 200, height: 100 },
		);
		assert.equal(document.layers.length, 2);
		const text = top(document);
		assert.equal(text.text, "Second");
		assert.equal(text.color, "#ff0000");
		assert.equal(text.transform.x, 100);
		assert.equal(text.transform.y, 50);
	});
});

describe("updateTextLayer", () => {
	test("edits the text layer", () => {
		const document = addTextLayer(blank(), "Hello");
		const next = updateTextLayer(document, top(document).id, {
			text: "Bye",
			align: "left",
		});
		assert.equal(top(next).text, "Bye");
		assert.equal(top(next).align, "left");
	});

	test("leaves the document be when nothing would change", () => {
		const document = addTextLayer(blank(), "Hello");
		const { id, text, color } = top(document);
		assert.equal(updateTextLayer(document, id, { text, color }), document);
		assert.equal(updateTextLayer(document, id, {}), document);
		assert.equal(updateTextLayer(document, "gone", { text: "Bye" }), document);
	});
});
