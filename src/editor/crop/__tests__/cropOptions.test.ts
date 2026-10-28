/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
} from "../../../model/document.ts";
import { framingAnchor } from "../../../model/framing.ts";
import { createDrawingLayer } from "../../../model/layers/drawing.ts";
import type { Layer } from "../../../model/layers/layer.ts";
import { createRedactionBox } from "../../../model/layers/redaction.ts";
import { createTextLayer } from "../../../model/layers/text.ts";
import { turnedSize } from "../cropGeometry.ts";
import {
	ASPECT_ROWS,
	ASPECTS,
	aspectRatio,
	turnedAspect,
	turnLayersLabel,
} from "../cropOptions.ts";

const photo = { width: 4000, height: 3000 };

describe("ASPECT_ROWS", () => {
	test("holds every ratio once", () => {
		const ids = ASPECT_ROWS.flat();
		assert.equal(new Set(ids).size, ids.length);
		assert.deepEqual([...ids].sort(), ASPECTS.map(({ id }) => id).sort());
	});
});

describe("turnedAspect", () => {
	test("pairs each fixed ratio with its inverse, both ways", () => {
		for (const { id, ratio } of ASPECTS) {
			if (typeof ratio !== "number" || ratio === 1) continue;
			const turned = turnedAspect(id);
			assert.ok(turned, `${id} has a turned ratio`);
			assert.equal(turnedAspect(turned), id);
			assert.equal(aspectRatio(turned, photo), 1 / ratio);
		}
	});

	test("keeps Free, Original, and Square", () => {
		assert.equal(turnedAspect("free"), undefined);
		assert.equal(turnedAspect("original"), undefined);
		assert.equal(turnedAspect("1:1"), undefined);
	});
});

describe("aspectRatio", () => {
	test("is null for Free", () => {
		assert.equal(aspectRatio("free", photo), null);
	});

	test("reads Original from the turned photo", () => {
		assert.equal(aspectRatio("original", turnedSize(photo, 0)), 4 / 3);
		assert.equal(aspectRatio("original", turnedSize(photo, 1)), 3 / 4);
	});

	test("gives each fixed ratio's value", () => {
		assert.equal(aspectRatio("1:1", photo), 1);
		assert.equal(aspectRatio("4:5", photo), 4 / 5);
		assert.equal(aspectRatio("16:9", photo), 16 / 9);
	});
});

describe("turnLayersLabel", () => {
	const withLayers = (...layers: Layer[]) => {
		const document = createDocumentFromImage(
			"file:///photo.jpg",
			photo.width,
			photo.height,
			true,
		);
		document.layers.push(...layers);
		return { layers: document.layers, anchor: framingAnchor(document).layer };
	};
	const text = () => createTextLayer(photo, "HI");
	const drawing = () =>
		createDrawingLayer({
			type: "pen",
			points: [0, 0, 10, 10],
			color: "#000000",
			width: 4,
		});
	const redaction = () =>
		createRedactionBox(
			{ x: 0, y: 0, width: 100, height: 100 },
			{ type: "solid", color: "#000000" },
		);

	test("is null with no other layers, hidden ones, or only redactions", () => {
		const none = withLayers();
		assert.equal(turnLayersLabel(none.layers, none.anchor), null);
		const hidden = withLayers({ ...text(), hidden: true });
		assert.equal(turnLayersLabel(hidden.layers, hidden.anchor), null);
		const redacted = withLayers(redaction());
		assert.equal(turnLayersLabel(redacted.layers, redacted.anchor), null);
	});

	test("says text with only text, layers with any other kind", () => {
		const onlyText = withLayers(text(), redaction());
		assert.equal(
			turnLayersLabel(onlyText.layers, onlyText.anchor),
			"Turn text",
		);
		const mixed = withLayers(text(), drawing());
		assert.equal(turnLayersLabel(mixed.layers, mixed.anchor), "Turn layers");
	});

	test("counts every layer on a blank canvas", () => {
		const document = createBlankDocument(1000, 1000, "#FFFFFF");
		document.layers.push(text());
		const { layer } = framingAnchor(document);
		assert.equal(layer, null);
		assert.equal(turnLayersLabel(document.layers, layer), "Turn text");
	});
});
