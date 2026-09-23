/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SkImage } from "@shopify/react-native-skia";
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

describe("decodeImageLayers", () => {
	test("shares a decode between layers with the same URI", async () => {
		const document = createDocumentFromImage("photo.jpg", 100, 80);
		const photo = document.layers[0] as ImageLayer;
		const copy = duplicateLayer({ ...photo, locked: false });
		document.layers.push(copy);
		const decoded = fakeImage();
		let calls = 0;

		const result = await decodeImageLayers(document.layers, async () => {
			calls++;
			return decoded.image;
		});

		assert.equal(calls, 1);
		assert.equal(result.images.get(photo.id), decoded.image);
		assert.equal(result.images.get(copy.id), decoded.image);
		result.dispose();
		result.dispose();
		assert.equal(decoded.disposals(), 1);
	});

	test("disposes earlier images when a later decode fails", async () => {
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

		await assert.rejects(
			decodeImageLayers(document.layers, async (uri) => {
				if (uri === "first.jpg") return first.image;
				throw failure;
			}),
			failure,
		);
		assert.equal(first.disposals(), 1);
	});
});
