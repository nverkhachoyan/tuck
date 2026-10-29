/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
} from "../../../document/document.ts";
import { duplicateLayer } from "../../layer.ts";
import { neutralAdjustments } from "../adjustments.ts";
import {
	createImageLayer,
	createStickerLayer,
	type ImageLayer,
	maxNewImageShortSide,
	withAdjustments,
} from "../image.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

describe("placing a new image in the part of the photo in view", () => {
	// A quarter of the photo either way, zoomed into near its top-left.
	const area = { x: 400, y: 300, width: 1000, height: 750 };

	test("shrinks a photo to sit inside it", () => {
		const layer = createImageLayer(landscape(), "x", 2000, 1500, true, area);
		assert.equal(layer.transform.x, 900);
		assert.equal(layer.transform.y, 675);
		assert.equal(layer.transform.scaleX, 0.4);
	});

	test("sizes a sticker to it", () => {
		const layer = createStickerLayer(landscape(), "x", 500, 500, false, area);
		assert.equal(layer.transform.x, 900);
		assert.equal(layer.transform.scaleX, (750 * 0.3) / 500);
	});
});

describe("createStickerLayer", () => {
	test("centers a sticker across a share of the canvas's shorter side", () => {
		const document = createBlankDocument(1080, 1920, "#FFFFFF");
		const layer = createStickerLayer(
			document,
			"file:///sticker.png",
			512,
			512,
			false,
		);
		const scale = (1080 * 0.3) / 512;
		assert.deepEqual(layer, {
			type: "image",
			id: layer.id,
			uri: "file:///sticker.png",
			width: 512,
			height: 512,
			flipped: false,
			opaque: false,
			sticker: true,
			transform: { x: 540, y: 960, scaleX: scale, scaleY: scale, rotation: 0 },
			hidden: false,
			locked: false,
		});
	});

	test("is enlarged past its pixels on a large photo", () => {
		const layer = createStickerLayer(landscape(), "a", 512, 512, false);
		assert.equal(layer.transform.scaleX, (3000 * 0.3) / 512);
	});

	test("fits its longer side", () => {
		const layer = createStickerLayer(landscape(), "a", 256, 512, false);
		assert.equal(layer.transform.scaleY, (3000 * 0.3) / 512);
	});

	test("keeps its mark when duplicated", () => {
		const layer = createStickerLayer(landscape(), "a", 512, 512, false);
		assert.equal(duplicateLayer(layer).sticker, true);
	});
});

describe("createImageLayer", () => {
	test("centers a large photo, shrunk to fit well inside the canvas", () => {
		const document = createBlankDocument(1080, 1920, "#FFFFFF");
		const layer = createImageLayer(
			document,
			"file:///added.jpg",
			4000,
			3000,
			true,
		);
		const scale = (1080 * 0.8) / 4000;
		assert.deepEqual(layer, {
			type: "image",
			id: layer.id,
			uri: "file:///added.jpg",
			width: 4000,
			height: 3000,
			flipped: false,
			opaque: true,
			transform: { x: 540, y: 960, scaleX: scale, scaleY: scale, rotation: 0 },
			hidden: false,
			locked: false,
		});
	});

	test("fits by whichever side is tighter", () => {
		const layer = createImageLayer(landscape(), "a", 1000, 3000, true);
		assert.equal(layer.transform.scaleX, (3000 * 0.8) / 3000);
		const wide = createImageLayer(landscape(), "b", 8000, 1000, true);
		assert.equal(wide.transform.scaleX, (4000 * 0.8) / 8000);
	});

	test("never enlarges a small photo", () => {
		const layer = createImageLayer(landscape(), "a", 300, 200, true);
		assert.equal(layer.transform.scaleX, 1);
		assert.equal(layer.transform.scaleY, 1);
	});

	test("gives every layer a unique id", () => {
		const document = landscape();
		const ids = new Set(
			Array.from(
				{ length: 50 },
				() => createImageLayer(document, "a", 10, 10, true).id,
			),
		);
		assert.equal(ids.size, 50);
	});
});

describe("maxNewImageShortSide", () => {
	test("covers the canvas turned either way, with room to enlarge", () => {
		// A landscape photo filling a Story canvas needs a shorter side of 1920.
		assert.equal(
			maxNewImageShortSide(createBlankDocument(1080, 1920, null)),
			2880,
		);
		assert.equal(
			maxNewImageShortSide(createBlankDocument(1920, 1080, null)),
			2880,
		);
		assert.equal(
			maxNewImageShortSide(createBlankDocument(1081, 1081, null)),
			1622,
		);
	});

	test("keeps enough that a photo shrunk to it lands as the original would", () => {
		const document = createBlankDocument(1080, 1350, "#FFFFFF");
		assert.equal(maxNewImageShortSide(document), 2025);
		// A 24MP camera photo, and the same photo with its shorter side at 2025.
		for (const [width, height] of [
			[5712, 4284],
			[2700, 2025],
		]) {
			const { transform } = createImageLayer(
				document,
				"a",
				width,
				height,
				true,
			);
			assert.equal(Math.round(width * transform.scaleX), 864);
			assert.equal(Math.round(height * transform.scaleY), 648);
		}
	});
});

describe("withAdjustments", () => {
	const photo = () => landscape().layers[0] as ImageLayer;
	const warm = { ...neutralAdjustments, temperature: 0.4 };

	test("sets adjustments, and leaves the layer be when they're the same", () => {
		const adjusted = withAdjustments(photo(), warm);
		assert.deepEqual(adjusted.adjustments, warm);
		assert.equal(withAdjustments(adjusted, { ...warm }), adjusted);
	});

	test("leaves out adjustments that change nothing", () => {
		const layer = photo();
		assert.equal(withAdjustments(layer, neutralAdjustments), layer);
		const reset = withAdjustments(
			withAdjustments(layer, warm),
			neutralAdjustments,
		);
		assert.equal("adjustments" in reset, false);
		assert.deepEqual(reset, layer);
	});
});
