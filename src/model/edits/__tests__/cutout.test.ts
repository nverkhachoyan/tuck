/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	addLayerOnTop,
	createDocumentFromImage,
	type EditorDocument,
} from "../../document.ts";
import type { CutStroke, ImageLayer } from "../../layers/image.ts";
import { createTextLayer } from "../../layers/text.ts";
import { invertMask, paintMask, setMask } from "../cutout.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);
const image = (document: EditorDocument) => document.layers[0] as ImageLayer;
const eraser: CutStroke = { type: "eraser", width: 10, points: [2000, 1500] };
const pen: CutStroke = { ...eraser, type: "pen" };

describe("setMask", () => {
	test("cuts the image out, and leaves the document be for the same mask", () => {
		const cut = setMask(photo(), "photo", "file:///a.png");
		assert.equal(image(cut).mask, "file:///a.png");
		assert.equal(setMask(cut, "photo", "file:///a.png"), cut);
	});

	test("keeps the strokes when asked", () => {
		const refined = paintMask(
			setMask(photo(), "photo", "file:///a.png"),
			"photo",
			eraser,
		);
		const grown = setMask(refined, "photo", "file:///b.png", {
			keepStrokes: true,
		});
		assert.deepEqual(image(grown).maskStrokes, image(refined).maskStrokes);
	});

	test("masks only images", () => {
		const document = photo();
		const withText = addLayerOnTop(
			document,
			createTextLayer(document, "Hello"),
		);
		assert.equal(
			setMask(withText, withText.layers[1].id, "file:///a.png"),
			withText,
		);
		assert.equal(setMask(withText, "gone", "file:///a.png"), withText);
	});
});

describe("invertMask", () => {
	test("takes the inverted mask for a cut image", () => {
		const cut = setMask(photo(), "photo", "file:///a.png");
		const inverted = invertMask(cut, "photo", "file:///b.png");
		assert.equal(image(inverted).mask, "file:///b.png");
	});

	test("leaves an uncut image be", () => {
		const document = photo();
		assert.equal(invertMask(document, "photo", "file:///b.png"), document);
	});
});

describe("paintMask", () => {
	test("refines the cut with a stroke", () => {
		const cut = setMask(photo(), "photo", "file:///a.png");
		const refined = paintMask(cut, "photo", pen);
		assert.equal(image(refined).maskStrokes?.length, 1);
	});

	test("erases an uncut image, but a pen there keeps it whole", () => {
		const document = photo();
		assert.equal(paintMask(document, "photo", pen), document);
		assert.equal(
			image(paintMask(document, "photo", eraser)).maskStrokes?.length,
			1,
		);
	});

	test("leaves the document be for a stroke with no points", () => {
		const document = photo();
		assert.equal(
			paintMask(document, "photo", { ...eraser, points: [] }),
			document,
		);
	});
});
