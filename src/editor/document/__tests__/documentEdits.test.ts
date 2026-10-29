/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDocumentFromImage } from "../document.ts";
import { reframe, setBackground } from "../documentEdits.ts";
import { documentFraming } from "../framing.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

describe("reframe", () => {
	test("puts the document in the new framing", () => {
		const document = photo();
		const framing = { ...documentFraming(document), width: 2000 };
		const cropped = reframe(document, framing, false);
		assert.equal(cropped.width, 2000);
		assert.deepEqual(documentFraming(cropped), framing);
	});

	test("leaves the document be in the framing it has", () => {
		const document = photo();
		assert.equal(reframe(document, documentFraming(document), true), document);
	});
});

describe("setBackground", () => {
	test("fills the canvas, and leaves the document be for the same fill", () => {
		const document = photo();
		const filled = setBackground(document, "#ffffff");
		assert.equal(filled.background, "#ffffff");
		assert.equal(setBackground(filled, "#ffffff"), filled);
		assert.equal(setBackground(document, null), document);
	});
});
