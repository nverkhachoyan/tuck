/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDocumentFromImage } from "../../../document/document.ts";
import type { ImageLayer } from "../../image/image.ts";
import { createMaskedRedaction, effectsEqual } from "../redaction.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

describe("createMaskedRedaction", () => {
	const image = (rotation: number): ImageLayer => ({
		...(landscape().layers[0] as ImageLayer),
		transform: { x: 500, y: 400, scaleX: 0.5, scaleY: 0.5, rotation },
	});

	test("lands on the part of the image it covers, scaled with it", () => {
		const redaction = createMaskedRedaction(
			image(0),
			"file:///selection.png",
			{ x: 0, y: 0, width: 1000, height: 600 },
			{ type: "blur", radius: 24 },
		);
		// The image's top left corner is at (500 - 1000, 400 - 750).
		assert.deepEqual(redaction.transform, {
			x: -500 + 250,
			y: -350 + 150,
			scaleX: 0.5,
			scaleY: 0.5,
			rotation: 0,
		});
		assert.equal(redaction.width, 1000);
		assert.equal(redaction.height, 600);
		assert.equal(redaction.mask, "file:///selection.png");
	});

	test("turns with the image", () => {
		const redaction = createMaskedRedaction(
			image(Math.PI / 2),
			"m",
			{ x: 2000, y: 0, width: 2000, height: 1500 },
			{ type: "blur", radius: 24 },
		);
		// Its center is 1000 right and 750 up of the image's, before scaling;
		// turned a quarter clockwise, that's 375 right and 500 down.
		assert.equal(redaction.transform.rotation, Math.PI / 2);
		assert.ok(Math.abs(redaction.transform.x - 875) < 1e-9);
		assert.ok(Math.abs(redaction.transform.y - 900) < 1e-9);
	});
});

describe("effectsEqual", () => {
	const black = { type: "solid", color: "#000000" } as const;
	const blur = { type: "blur", radius: 16 } as const;
	const pixels = { type: "pixelate", size: 16 } as const;

	test("matches a copy of each effect", () => {
		for (const effect of [black, blur, pixels]) {
			assert.equal(effectsEqual(effect, { ...effect }), true);
		}
	});

	test("tells apart another setting or another effect", () => {
		assert.equal(effectsEqual(black, { ...black, color: "#FFFFFF" }), false);
		assert.equal(effectsEqual(blur, { ...blur, radius: 24 }), false);
		assert.equal(effectsEqual(pixels, { ...pixels, size: 8 }), false);
		assert.equal(effectsEqual(blur, pixels), false, "the same number");
		assert.equal(effectsEqual(pixels, blur), false);
		assert.equal(effectsEqual(black, blur), false);
	});
});
