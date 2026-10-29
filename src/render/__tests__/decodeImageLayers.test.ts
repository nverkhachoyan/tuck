/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SkImage } from "react-native-skia";
import { withMask } from "../../model/cutout.ts";
import { createDocumentFromImage } from "../../model/document.ts";
import type { ImageLayer } from "../../model/layers/image.ts";
import { duplicateLayer } from "../../model/layers/layer.ts";
import { decodeImageLayers } from "../decodeImageLayers.ts";
import { createImageCache } from "../imageCache.ts";

function fakeImage() {
	let disposals = 0;
	return {
		image: { dispose: () => disposals++ } as unknown as SkImage,
		disposals: () => disposals,
	};
}

// The cache frees released images on a timer.
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("decodeImageLayers", () => {
	test("shares a decode between layers with the same URI", async () => {
		const document = createDocumentFromImage("photo.jpg", 100, 80, true);
		const photo = document.layers[0] as ImageLayer;
		const copy = duplicateLayer({ ...photo, locked: false });
		document.layers.push(copy);
		const decoded = fakeImage();
		let calls = 0;
		const cache = createImageCache(async () => {
			calls++;
			return decoded.image;
		});

		const result = await decodeImageLayers(document.layers, cache);

		assert.equal(calls, 1);
		assert.deepEqual([...result.images], [[photo.uri, decoded.image]]);
		assert.equal(copy.uri, photo.uri);
		result.release();
		result.release();
		await nextTask();
		assert.equal(decoded.disposals(), 1);
	});

	test("reuses an image another holder has decoded, and leaves it to them", async () => {
		const document = createDocumentFromImage("photo.jpg", 100, 80, true);
		const photo = document.layers[0] as ImageLayer;
		const decoded = fakeImage();
		let calls = 0;
		const cache = createImageCache(async () => {
			calls++;
			return decoded.image;
		});
		const editor = cache.acquire("photo.jpg");
		await editor.decoded;

		const result = await decodeImageLayers(document.layers, cache);
		result.release();
		await nextTask();

		assert.equal(calls, 1);
		assert.equal(result.images.get(photo.uri), decoded.image);
		assert.equal(decoded.disposals(), 0);
		editor.release();
		await nextTask();
		assert.equal(decoded.disposals(), 1);
	});

	test("decodes a cut-out's mask with its image", async () => {
		const document = createDocumentFromImage("photo.jpg", 100, 80, true);
		document.layers[0] = withMask(document.layers[0] as ImageLayer, "mask.png");
		const photo = fakeImage();
		const mask = fakeImage();
		const cache = createImageCache(async (uri) =>
			uri === "mask.png" ? mask.image : photo.image,
		);

		const result = await decodeImageLayers(document.layers, cache);
		assert.equal(result.images.get("photo.jpg"), photo.image);
		assert.equal(result.images.get("mask.png"), mask.image);
		result.release();
		await nextTask();
		assert.equal(mask.disposals(), 1);
	});

	test("releases earlier images when a later decode fails", async () => {
		const document = createDocumentFromImage("first.jpg", 100, 80, true);
		const first = fakeImage();
		const second = {
			...(document.layers[0] as ImageLayer),
			id: "second",
			uri: "second.jpg",
			locked: false,
		};
		document.layers.push(second);
		const failure = new Error("decode failed");
		const cache = createImageCache(async (uri) => {
			if (uri === "first.jpg") return first.image;
			throw failure;
		});

		await assert.rejects(decodeImageLayers(document.layers, cache), failure);
		await nextTask();
		assert.equal(first.disposals(), 1);
	});
});
