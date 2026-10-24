/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { neutralAdjustments } from "../../adjustments.ts";
import {
	addLayerOnTop,
	createDocumentFromImage,
	createTextLayer,
	type ImageLayer,
} from "../../document.ts";
import { setAdjustments } from "../adjust.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);
const brighter = { ...neutralAdjustments, brightness: 0.4 };

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
