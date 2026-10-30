/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	addLayerOnTop,
	createDocumentFromImage,
	type EditorDocument,
} from "../../../document/document.ts";
import { createTextLayer } from "../../text/text.ts";
import { neutralAdjustments } from "../adjustments.ts";
import type { CutStroke, ImageLayer } from "../image.ts";
import {
	addCutCopy,
	invertMask,
	paintMask,
	setAdjustments,
	setMask,
} from "../imageEdits.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);
const brighter = { ...neutralAdjustments, brightness: 0.4 };
const image = (document: EditorDocument) => document.layers[0] as ImageLayer;
const eraser: CutStroke = { type: "eraser", width: 10, points: [2000, 1500] };
const pen: CutStroke = { ...eraser, type: "pen" };

describe("setAdjustments", () => {
	test("adjusts the image", () => {
		const next = setAdjustments(photo(), "photo", brighter);
		assert.deepEqual((next.layers[0] as ImageLayer).adjustments, brighter);
	});

	test("leaves the document be when nothing would change", () => {
		const document = photo();
		assert.equal(
			setAdjustments(document, "photo", neutralAdjustments),
			document,
		);
		const adjusted = setAdjustments(document, "photo", brighter);
		assert.equal(setAdjustments(adjusted, "photo", { ...brighter }), adjusted);
	});

	test("adjusts only images", () => {
		const document = photo();
		const withText = addLayerOnTop(
			document,
			createTextLayer(document, "Hello"),
		);
		const textId = withText.layers[1].id;
		assert.equal(setAdjustments(withText, textId, brighter), withText);
		assert.equal(setAdjustments(withText, "gone", brighter), withText);
	});
});

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

describe("addCutCopy", () => {
	const strokes: CutStroke[] = [pen];
	const withText = () => {
		const document = photo();
		return addLayerOnTop(document, createTextLayer(document, "Hello"));
	};

	test("puts a copy cut to the selection just above its image, exactly over it", () => {
		const document = withText();
		const next = addCutCopy(
			document,
			"photo",
			{ mask: "file:///a.png", maskStrokes: strokes },
			"copy",
		);
		assert.deepEqual(
			next.layers.map((layer) => layer.id),
			["photo", "copy", document.layers[1].id],
		);
		const copy = next.layers[1] as ImageLayer;
		assert.equal(copy.uri, image(document).uri);
		assert.deepEqual(copy.transform, image(document).transform);
		assert.equal(copy.mask, "file:///a.png");
		assert.equal(copy.maskStrokes, strokes);
		assert.equal(next.layers[0], document.layers[0]);
	});

	test("takes the selection's cut, not its source's, and starts unlocked", () => {
		const cut = setMask(photo(), "photo", "file:///old.png");
		assert.equal(image(cut).locked, true);
		const copy = addCutCopy(cut, "photo", { maskStrokes: strokes }, "copy")
			.layers[1] as ImageLayer;
		assert.equal("mask" in copy, false);
		assert.equal(copy.maskStrokes, strokes);
		assert.equal(copy.locked, false);
		assert.equal(copy.hidden, false);
	});

	test("copies only images", () => {
		const document = withText();
		const textId = document.layers[1].id;
		const selection = { mask: "file:///a.png" };
		assert.equal(addCutCopy(document, textId, selection, "copy"), document);
		assert.equal(addCutCopy(document, "gone", selection, "copy"), document);
	});
});
