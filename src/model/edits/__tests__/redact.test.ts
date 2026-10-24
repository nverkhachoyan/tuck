/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
} from "../../document.ts";
import { identityTransform } from "../../layers/base.ts";
import type {
	RedactionEffect,
	RedactionLayer,
} from "../../layers/redaction.ts";
import type { MaskStroke } from "../../strokes.ts";
import {
	addMaskedRedaction,
	addRedactionBox,
	addRedactionBoxes,
	paintRedaction,
	setRedactionEffect,
} from "../redact.ts";

const black: RedactionEffect = { type: "solid", color: "#000000" };
const blur: RedactionEffect = { type: "blur", radius: 12 };
const blank = () => createBlankDocument(400, 300, "#ffffff");
const rect = { x: 10, y: 20, width: 100, height: 50 };
const pen: MaskStroke = { type: "pen", width: 20, points: [0, 0, 50, 50] };
const eraser: MaskStroke = { ...pen, type: "eraser" };

const top = (document: { layers: unknown[] }) =>
	document.layers.at(-1) as RedactionLayer;

describe("addRedactionBox", () => {
	test("puts a box over the rect on top", () => {
		const added = top(addRedactionBox(blank(), rect, black));
		assert.equal(added.shape, "box");
		assert.deepEqual(added.effect, black);
		assert.equal(added.transform.x, 60);
		assert.equal(added.transform.y, 45);
	});

	test("adds nothing for a box with no area", () => {
		const document = blank();
		assert.equal(
			addRedactionBox(document, { ...rect, height: 0 }, black),
			document,
		);
	});
});

describe("addRedactionBoxes", () => {
	const placement = { width: 40, height: 20, transform: identityTransform };

	test("adds the boxes on top in one named group", () => {
		const next = addRedactionBoxes(
			blank(),
			[placement, { ...placement, width: 0 }, placement],
			blur,
			"Faces",
		);
		assert.equal(next.layers.length, 2);
		assert.equal(next.groups?.length, 1);
		assert.equal(next.groups?.[0].name, "Faces");
		assert.deepEqual(
			next.groups?.[0].layerIds,
			next.layers.map((layer) => layer.id),
		);
	});

	test("names the group for Find unless told otherwise", () => {
		const next = addRedactionBoxes(blank(), [placement], blur);
		assert.equal(next.groups?.[0].name, "Find results");
	});

	test("adds nothing when no box has an area", () => {
		const document = blank();
		assert.equal(
			addRedactionBoxes(document, [{ ...placement, height: 0 }], blur),
			document,
		);
	});
});

describe("addMaskedRedaction", () => {
	test("covers the selection on the image, on top", () => {
		const document = createDocumentFromImage("file:///p.jpg", 400, 300, true);
		const added = top(
			addMaskedRedaction(document, "photo", "file:///m.png", rect, blur),
		);
		assert.equal(added.shape, "mask");
		assert.equal(added.transform.x, 60);
	});

	test("adds nothing over a missing image or an empty rect", () => {
		const document = createDocumentFromImage("file:///p.jpg", 400, 300, true);
		assert.equal(
			addMaskedRedaction(document, "gone", "file:///m.png", rect, blur),
			document,
		);
		assert.equal(
			addMaskedRedaction(
				document,
				"photo",
				"file:///m.png",
				{ ...rect, width: 0 },
				blur,
			),
			document,
		);
	});
});

describe("paintRedaction", () => {
	test("starts a brushed redaction with a pen", () => {
		const added = top(paintRedaction(blank(), null, pen, blur));
		assert.equal(added.shape, "strokes");
		assert.deepEqual(added.effect, blur);
	});

	test("joins the selected brushed redaction, keeping its effect", () => {
		const first = paintRedaction(blank(), null, pen, blur);
		const id = top(first).id;
		const next = paintRedaction(first, id, eraser, black);
		assert.equal(next.layers.length, 1);
		const joined = top(next);
		assert.equal(joined.id, id);
		assert.equal(joined.shape === "strokes" && joined.strokes.length, 2);
		assert.deepEqual(joined.effect, blur);
	});

	test("starts a new one over a locked selection", () => {
		const first = paintRedaction(blank(), null, pen, blur);
		const locked = {
			...first,
			layers: [{ ...top(first), locked: true }],
		};
		const next = paintRedaction(locked, top(first).id, pen, blur);
		assert.equal(next.layers.length, 2);
	});

	test("leaves the document be for an eraser with nothing to join", () => {
		const document = blank();
		assert.equal(paintRedaction(document, null, eraser, blur), document);
	});

	test("leaves the document be for a stroke with no points", () => {
		const document = blank();
		assert.equal(
			paintRedaction(document, null, { ...pen, points: [] }, blur),
			document,
		);
	});
});

describe("setRedactionEffect", () => {
	test("restyles the redaction", () => {
		const document = addRedactionBox(blank(), rect, black);
		const next = setRedactionEffect(document, top(document).id, blur);
		assert.deepEqual(top(next).effect, blur);
	});

	test("leaves the document be for the same effect or another layer", () => {
		const document = addRedactionBox(blank(), rect, black);
		assert.equal(
			setRedactionEffect(document, top(document).id, {
				type: "solid",
				color: "#000000",
			}),
			document,
		);
		assert.equal(setRedactionEffect(document, "gone", blur), document);
	});
});
