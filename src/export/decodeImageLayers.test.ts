/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SkImage } from "@shopify/react-native-skia";
import { createImageCache } from "../layers/imageCache.ts";
import {
	createDocumentFromImage,
	duplicateLayer,
	type ImageLayer,
} from "../model/document.ts";
import { decodeImageLayers } from "./decodeImageLayers.ts";

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
		const document = createDocumentFromImage("photo.jpg", 100, 80);
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
		assert.equal(result.images.get(photo.id), decoded.image);
		assert.equal(result.images.get(copy.id), decoded.image);
		result.release();
		result.release();
		await nextTask();
		assert.equal(decoded.disposals(), 1);
	});

	test("reuses an image another holder has decoded, and leaves it to them", async () => {
		const document = createDocumentFromImage("photo.jpg", 100, 80);
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
		assert.equal(result.images.get(photo.id), decoded.image);
		assert.equal(decoded.disposals(), 0);
		editor.release();
		await nextTask();
		assert.equal(decoded.disposals(), 1);
	});

	test("releases earlier images when a later decode fails", async () => {
		const document = createDocumentFromImage("first.jpg", 100, 80);
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
