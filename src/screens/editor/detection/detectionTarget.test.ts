/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type {
	EditorDocument,
	ImageLayer,
	TextLayer,
} from "../../../model/document.ts";
import { detectionTarget, detectionTargetKey } from "./detectionTarget.ts";

function image(id: string, overrides: Partial<ImageLayer> = {}): ImageLayer {
	return {
		type: "image",
		id,
		uri: `file:///${id}.jpg`,
		width: 800,
		height: 600,
		flipped: false,
		opaque: true,
		transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0 },
		hidden: false,
		locked: false,
		...overrides,
	};
}

function text(id: string): TextLayer {
	return {
		type: "text",
		id,
		text: "Hello",
		font: "classic",
		fontSize: 32,
		color: "#ffffff",
		align: "center",
		outlineColor: null,
		backgroundColor: null,
		maxWidth: 400,
		transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
		hidden: false,
		locked: false,
	};
}

describe("detectionTarget", () => {
	test("prefers a selected visible image layer", () => {
		const bg = image("bg", { locked: true });
		const sticker = image("sticker");
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [bg, sticker],
		};
		assert.equal(detectionTarget(doc, sticker), sticker);
	});

	test("ignores a selected hidden image layer", () => {
		const bg = image("bg", { locked: true });
		const sticker = image("sticker", { hidden: true });
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [bg, sticker],
		};
		assert.equal(detectionTarget(doc, sticker), bg);
	});

	test("falls back to the locked framing photo when text is selected", () => {
		const bg = image("bg", { locked: true });
		const heading = text("heading");
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [bg, heading],
		};
		assert.equal(detectionTarget(doc, heading), bg);
	});

	test("falls back to the first visible image when none is locked", () => {
		const img1 = image("img1", { locked: false });
		const img2 = image("img2", { locked: false });
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [img1, img2],
		};
		assert.equal(detectionTarget(doc, undefined), img1);
	});

	test("returns null when the document contains no images", () => {
		const heading = text("heading");
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [heading],
		};
		assert.equal(detectionTarget(doc, heading), null);
		assert.equal(detectionTarget(doc, undefined), null);
	});
});

describe("detectionTargetKey", () => {
	test("changes whenever image geometry or document size changes", () => {
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [],
		};
		const base = image("photo");
		const key1 = detectionTargetKey(doc, base);
		const keySame = detectionTargetKey(doc, { ...base });
		assert.equal(key1, keySame);

		const keyMoved = detectionTargetKey(doc, {
			...base,
			transform: { ...base.transform, x: 405 },
		});
		assert.notEqual(key1, keyMoved);

		const keyRotated = detectionTargetKey(doc, {
			...base,
			transform: { ...base.transform, rotation: 0.1 },
		});
		assert.notEqual(key1, keyRotated);

		const keyFlipped = detectionTargetKey(doc, { ...base, flipped: true });
		assert.notEqual(key1, keyFlipped);

		const keyDocResized = detectionTargetKey({ ...doc, width: 1000 }, base);
		assert.notEqual(key1, keyDocResized);
	});

	test("handles null target layer", () => {
		const doc: EditorDocument = {
			width: 800,
			height: 600,
			background: null,
			layers: [],
		};
		assert.equal(detectionTargetKey(doc, null), "none:800:600");
	});
});
