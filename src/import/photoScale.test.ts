/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { photoScale } from "./photoScale.ts";

const MP = 1_000_000;

describe("photoScale", () => {
	test("leaves a photo within both limits as it is", () => {
		assert.equal(photoScale({ width: 4032, height: 3024 }, 24 * MP), 1);
		assert.equal(photoScale({ width: 4032, height: 3024 }, 24 * MP, 3024), 1);
	});

	test("shrinks a photo to the pixel limit", () => {
		assert.equal(
			photoScale({ width: 8000, height: 6000 }, 24 * MP),
			Math.sqrt(0.5),
		);
	});

	test("shrinks the shorter side to its limit, either way round", () => {
		assert.equal(photoScale({ width: 4000, height: 3000 }, 24 * MP, 1500), 0.5);
		assert.equal(photoScale({ width: 3000, height: 4000 }, 24 * MP, 1500), 0.5);
	});

	test("takes whichever limit shrinks the photo more", () => {
		const camera = { width: 8000, height: 6000 };
		assert.equal(photoScale(camera, 24 * MP, 3000), 0.5);
		assert.equal(photoScale(camera, 24 * MP, 5000), Math.sqrt(0.5));
	});
});
