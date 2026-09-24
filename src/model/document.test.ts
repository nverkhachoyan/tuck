/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
	createImageLayer,
	createTextLayer,
	defaultTextStyle,
	duplicateLayer,
	type EditorDocument,
	hasEdits,
	hasTransparency,
	type ImageLayer,
	initialFontSize,
	reorderLayer,
} from "./document.ts";

const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000);

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
		assert.equal(createTextLayer(document, "x", "center").locked, false);
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
		});
	});
});

describe("hasEdits", () => {
	test("is false for the photo alone and true once a layer is added", () => {
		const document = landscape();
		assert.equal(hasEdits(document), false);
		document.layers.push(createTextLayer(document, "TOP TEXT", "center"));
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
		document.layers.push(createTextLayer(document, "HELLO", "center"));
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

	test("is false while any visible image covers the canvas", () => {
		const document = landscape();
		const [photo] = document.layers;
		const text = createTextLayer(document, "TOP", "center");
		document.layers = [text, { ...photo, id: "copy" }, photo];
		document.layers[2].hidden = true;
		assert.equal(hasTransparency(document), false);
	});
});

describe("initialFontSize", () => {
	test("scales with the photo's shorter side", () => {
		const small = initialFontSize(createDocumentFromImage("a", 1000, 2000));
		const large = initialFontSize(createDocumentFromImage("b", 4000, 3000));
		assert.equal(large / small, 3);
	});
});

describe("createTextLayer", () => {
	test("starts centered, in the meme style, wrapping at 90% width", () => {
		const document = landscape();
		const layer = createTextLayer(document, "hello", "left");
		assert.equal(layer.transform.x, 2000);
		assert.equal(layer.transform.y, 1500);
		assert.equal(layer.font, "classic");
		assert.equal(layer.color, defaultTextStyle.color);
		assert.equal(layer.outlineColor, defaultTextStyle.outlineColor);
		assert.equal(layer.backgroundColor, null);
		assert.equal(layer.align, "left");
		assert.equal(layer.maxWidth, 3600);
		assert.equal(layer.hidden, false);
	});

	test("gives every layer a unique id", () => {
		const document = landscape();
		const ids = new Set(
			Array.from(
				{ length: 50 },
				() => createTextLayer(document, "x", "center").id,
			),
		);
		assert.equal(ids.size, 50);
	});
});

describe("createImageLayer", () => {
	test("centers a large photo, shrunk to fit well inside the canvas", () => {
		const document = createBlankDocument(1080, 1920, "#FFFFFF");
		const layer = createImageLayer(document, "file:///added.jpg", 4000, 3000);
		const scale = (1080 * 0.8) / 4000;
		assert.deepEqual(layer, {
			type: "image",
			id: layer.id,
			uri: "file:///added.jpg",
			width: 4000,
			height: 3000,
			flipped: false,
			transform: { x: 540, y: 960, scaleX: scale, scaleY: scale, rotation: 0 },
			hidden: false,
			locked: false,
		});
	});

	test("fits by whichever side is tighter", () => {
		const layer = createImageLayer(landscape(), "a", 1000, 3000);
		assert.equal(layer.transform.scaleX, (3000 * 0.8) / 3000);
		const wide = createImageLayer(landscape(), "b", 8000, 1000);
		assert.equal(wide.transform.scaleX, (4000 * 0.8) / 8000);
	});

	test("never enlarges a small photo", () => {
		const layer = createImageLayer(landscape(), "a", 300, 200);
		assert.equal(layer.transform.scaleX, 1);
		assert.equal(layer.transform.scaleY, 1);
	});

	test("gives every layer a unique id", () => {
		const document = landscape();
		const ids = new Set(
			Array.from(
				{ length: 50 },
				() => createImageLayer(document, "a", 10, 10).id,
			),
		);
		assert.equal(ids.size, 50);
	});

	test("counts as an edit, even on a transparent canvas its own size", () => {
		const document = createBlankDocument(1080, 1080, null);
		document.layers.push(createImageLayer(document, "a", 1080, 1080));
		assert.equal(hasEdits(document), true);
	});
});

describe("duplicateLayer", () => {
	test("copies text with a new id, nudged by half a scaled line", () => {
		const original = {
			...createTextLayer(landscape(), "copy me", "right"),
			transform: { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 0.3 },
		};
		const copy = duplicateLayer(original);
		const offset = original.fontSize * 2 * 0.5;

		assert.notEqual(copy.id, original.id);
		assert.deepEqual(
			{ ...copy, id: original.id },
			{
				...original,
				transform: { ...original.transform, x: 100 + offset, y: 200 + offset },
			},
		);
	});
	test("copies an image with a new id, nudged by a tenth of its scaled size", () => {
		const original: ImageLayer = {
			type: "image",
			id: "sticker",
			uri: "file:///sticker.png",
			width: 400,
			height: 200,
			transform: { x: 100, y: 200, scaleX: 3, scaleY: 3, rotation: 0 },
			hidden: false,
			locked: false,
			flipped: false,
		};
		const copy = duplicateLayer(original);
		assert.notEqual(copy.id, original.id);
		assert.equal(copy.uri, original.uri);
		assert.equal(copy.transform.x, 100 + 60);
		assert.equal(copy.transform.y, 200 + 60);
	});
});

describe("reorderLayer", () => {
	// The photo plus text layers named a, b, c, bottom to top.
	const stack = (): EditorDocument["layers"] => {
		const document = landscape();
		return [
			...document.layers,
			...["a", "b", "c"].map((id) => ({
				...createTextLayer(document, id, "center"),
				id,
			})),
		];
	};
	const ids = (layers: EditorDocument["layers"]) =>
		layers.map((layer) => layer.id);

	test("moves a layer up or down the stack", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "a", 3)), [
			"photo",
			"b",
			"c",
			"a",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "c", 1)), [
			"photo",
			"c",
			"a",
			"b",
		]);
	});

	test("moves the photo like any layer", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "b", 0)), [
			"b",
			"photo",
			"a",
			"c",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "photo", 2)), [
			"a",
			"b",
			"photo",
			"c",
		]);
	});

	test("clamps past either end", () => {
		assert.deepEqual(ids(reorderLayer(stack(), "c", -5)), [
			"c",
			"photo",
			"a",
			"b",
		]);
		assert.deepEqual(ids(reorderLayer(stack(), "a", 99)), [
			"photo",
			"b",
			"c",
			"a",
		]);
	});

	test("returns the same array when nothing moves", () => {
		const layers = stack();
		assert.equal(reorderLayer(layers, "b", 2), layers);
		assert.equal(reorderLayer(layers, "missing", 1), layers);
	});

	test("never mutates the input", () => {
		const layers = stack();
		const before = [...layers];
		reorderLayer(layers, "a", 3);
		assert.deepEqual(layers, before);
	});
});
