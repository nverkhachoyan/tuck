/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { neutralAdjustments } from "../../layers/image/adjustments.ts";
import {
	createImageLayer,
	type ImageLayer,
	withAdjustments,
} from "../../layers/image/image.ts";
import { withMask } from "../../layers/image/mask.ts";
import { createTextLayer } from "../../layers/text/text.ts";
import {
	createBlankDocument,
	createDocumentFromImage,
	type EditorDocument,
	hasEdits,
	hasTransparency,
} from "../document.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

describe("createDocumentFromImage", () => {
	test("is sized to the photo, with the photo as its only layer", () => {
		const document = landscape();
		assert.equal(document.width, 4000);
		assert.equal(document.height, 3000);
		assert.equal(document.layers.length, 1);
		assert.equal(document.layers[0].type, "image");
		assert.equal(document.layers[0].hidden, false);
		assert.equal(document.background, null);
	});

	test("locks the photo, and leaves new text unlocked", () => {
		const document = landscape();
		assert.equal(document.layers[0].locked, true);
		assert.equal(createTextLayer(document, "x").locked, false);
	});

	test("centers the photo's transform, so it covers the document", () => {
		const { transform } = landscape().layers[0];
		assert.deepEqual(transform, {
			x: 2000,
			y: 1500,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
	});
});

describe("createBlankDocument", () => {
	test("is an empty canvas of the given size and fill", () => {
		assert.deepEqual(createBlankDocument(1080, 1920, "#FFFFFF"), {
			width: 1080,
			height: 1920,
			background: "#FFFFFF",
			layers: [],
			groups: [],
		});
	});
});

describe("hasEdits", () => {
	test("is false for the photo alone and true once a layer is added", () => {
		const document = landscape();
		assert.equal(hasEdits(document), false);
		document.layers.push(createTextLayer(document, "TOP TEXT"));
		assert.equal(hasEdits(document), true);
	});

	test("counts a crop, a move, a flip, or a background", () => {
		const photo = (document: EditorDocument) =>
			document.layers[0] as ImageLayer;
		const edits: ((document: EditorDocument) => void)[] = [
			(document) => {
				document.width = 3000;
			},
			(document) => {
				photo(document).transform.rotation = 0.1;
			},
			(document) => {
				photo(document).flipped = true;
			},
			(document) => {
				document.background = "#FFFFFF";
			},
			(document) => {
				document.layers[0] = withAdjustments(photo(document), {
					...neutralAdjustments,
					brightness: 0.2,
				});
			},
			(document) => {
				document.layers[0] = withMask(photo(document), "file:///mask.png");
			},
		];
		for (const edit of edits) {
			const document = landscape();
			edit(document);
			assert.equal(hasEdits(document), true);
		}
	});

	test("doesn't count unlocking the photo", () => {
		const document = landscape();
		document.layers[0].locked = false;
		assert.equal(hasEdits(document), false);
	});

	test("counts hiding the photo, but not deleting it", () => {
		const document = landscape();
		document.layers[0].hidden = true;
		assert.equal(hasEdits(document), true);
		document.layers = [];
		assert.equal(hasEdits(document), false);
	});

	test("is false for an empty canvas, whatever its fill", () => {
		const document = createBlankDocument(1080, 1080, "#000000");
		assert.equal(hasEdits(document), false);
		document.layers.push(createTextLayer(document, "HELLO"));
		assert.equal(hasEdits(document), true);
	});

	test("counts an added image, even on a transparent canvas its own size", () => {
		const document = createBlankDocument(1080, 1080, null);
		document.layers.push(createImageLayer(document, "a", 1080, 1080, true));
		assert.equal(hasEdits(document), true);
	});
});

describe("hasTransparency", () => {
	test("is false while the photo covers the canvas", () => {
		const document = landscape();
		assert.equal(hasTransparency(document), false);
		// A crop inside the photo, turned a quarter turn.
		document.width = 1000;
		document.height = 2000;
		document.layers[0].transform = {
			x: 500,
			y: 1000,
			scaleX: 1,
			scaleY: 1,
			rotation: Math.PI / 2,
		};
		assert.equal(hasTransparency(document), false);
	});

	test("is true where the canvas reaches past the photo, unless filled", () => {
		const document = landscape();
		document.height = 3600;
		assert.equal(hasTransparency(document), true);
		document.background = "#000000";
		assert.equal(hasTransparency(document), false);
	});

	test("is true with the photo hidden or gone, unless filled", () => {
		const document = landscape();
		document.layers[0].hidden = true;
		assert.equal(hasTransparency(document), true);
		assert.equal(hasTransparency(createBlankDocument(10, 10, null)), true);
		assert.equal(
			hasTransparency(createBlankDocument(10, 10, "#FFFFFF")),
			false,
		);
	});

	test("is true while only a cut-out photo covers the canvas", () => {
		const document = landscape();
		document.layers[0] = withMask(
			document.layers[0] as ImageLayer,
			"file:///mask.png",
		);
		assert.equal(hasTransparency(document), true);
	});

	test("is true while only a transparent image covers the canvas", () => {
		const document = landscape();
		const [photo] = document.layers;
		const cutout = { ...photo, id: "cutout", opaque: false };
		document.layers = [cutout];
		assert.equal(hasTransparency(document), true);
		document.layers = [photo, cutout];
		assert.equal(hasTransparency(document), false);
	});

	test("is false while any visible image covers the canvas", () => {
		const document = landscape();
		const [photo] = document.layers;
		const text = createTextLayer(document, "TOP");
		document.layers = [text, { ...photo, id: "copy" }, photo];
		document.layers[2].hidden = true;
		assert.equal(hasTransparency(document), false);
	});
});
