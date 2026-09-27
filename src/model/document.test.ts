/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { neutralAdjustments } from "./adjustments.ts";
import {
	createBlankDocument,
	createDocumentFromImage,
	createImageLayer,
	createRedactionBox,
	createShapeLayer,
	createStickerLayer,
	createTextLayer,
	defaultTextStyle,
	duplicateLayer,
	type EditorDocument,
	hasEdits,
	hasTransparency,
	type ImageLayer,
	initialFontSize,
	maxNewImageShortSide,
	reorderLayer,
	resizeLayerBox,
	restyleShape,
	type ShapeLayer,
	withAdjustments,
} from "./document.ts";

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

describe("initialFontSize", () => {
	test("scales with the photo's shorter side", () => {
		const small = initialFontSize(
			createDocumentFromImage("a", 1000, 2000, true),
		);
		const large = initialFontSize(
			createDocumentFromImage("b", 4000, 3000, true),
		);
		assert.equal(large / small, 3);
	});
});

describe("createTextLayer", () => {
	test("starts centered, in the meme style, wrapping at 90% width", () => {
		const document = landscape();
		const layer = createTextLayer(document, "hello", { align: "left" });
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
			Array.from({ length: 50 }, () => createTextLayer(document, "x").id),
		);
		assert.equal(ids.size, 50);
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

	test("counts as an edit, even on a transparent canvas its own size", () => {
		const document = createBlankDocument(1080, 1080, null);
		document.layers.push(createImageLayer(document, "a", 1080, 1080, true));
		assert.equal(hasEdits(document), true);
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

describe("duplicateLayer", () => {
	test("copies text with a new id, nudged by half a scaled line", () => {
		const original = {
			...createTextLayer(landscape(), "copy me", { align: "right" }),
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
			opaque: false,
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

	test("copies a shape, nudged by a tenth of its box or its length", () => {
		const box = duplicateLayer(rectangle());
		assert.equal(box.transform.x, 500 + 10);
		const line = duplicateLayer(arrow());
		assert.equal(line.transform.y, 300 + 40);
	});
});

const style = { color: "#FF3B30", strokeWidth: 12 };
const rectangle = () =>
	createShapeLayer(
		"rectangle",
		{ x: 500, y: 300, rotation: 0, width: 200, height: 100 },
		style,
	);
const arrow = () =>
	createShapeLayer(
		"arrow",
		{ x: 500, y: 300, rotation: Math.PI / 4, width: 400, height: 0 },
		style,
	);

describe("createShapeLayer", () => {
	test("places a box shape at its center, upright, at its size", () => {
		const shape = rectangle();
		assert.equal(shape.type, "shape");
		assert.equal(shape.shape, "rectangle");
		assert.deepEqual(shape.transform, {
			x: 500,
			y: 300,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
		assert.equal(shape.shape === "rectangle" && shape.width, 200);
		assert.equal(shape.shape === "rectangle" && shape.height, 100);
		assert.equal(shape.color, "#FF3B30");
		assert.equal(shape.strokeWidth, 12);
	});

	test("turns a line to its angle, and takes its width as its length", () => {
		const shape = arrow();
		assert.equal(shape.transform.rotation, Math.PI / 4);
		assert.equal(shape.shape === "arrow" && shape.length, 400);
		assert.equal("width" in shape, false);
	});
});

describe("restyleShape", () => {
	test("changes the color, thickness, or kind within its geometry", () => {
		const shape = rectangle();
		const restyled = restyleShape(shape, {
			shape: "ellipse",
			color: "#FFFFFF",
			strokeWidth: 4,
		});
		assert.deepEqual(restyled, {
			...shape,
			shape: "ellipse",
			color: "#FFFFFF",
			strokeWidth: 4,
		});
		assert.equal(restyleShape(arrow(), { shape: "line" }).shape, "line");
	});

	test("keeps a box a box and a line a line", () => {
		const box = rectangle();
		assert.equal(restyleShape(box, { shape: "arrow" }), box);
		const line = arrow();
		assert.equal(
			restyleShape(line, { shape: "ellipse", color: "#FFFFFF" }).shape,
			"arrow",
		);
	});

	test("returns the same layer when nothing changes", () => {
		const shape = rectangle();
		assert.equal(restyleShape(shape, {}), shape);
		assert.equal(restyleShape(shape, { ...style, shape: "rectangle" }), shape);
	});
});

describe("resizeLayerBox", () => {
	const moved = { x: 520, y: 300, scaleX: 1, scaleY: 1, rotation: 0 };

	test("resizes a box shape or a redaction's box, and moves it", () => {
		const shape = resizeLayerBox(rectangle(), moved, 240, 80) as ShapeLayer;
		assert.deepEqual(shape.transform, moved);
		assert.equal(shape.shape === "rectangle" && shape.width, 240);
		const redaction = createRedactionBox(
			{ x: 0, y: 0, width: 10, height: 10 },
			{ type: "solid", color: "#000000" },
		);
		assert.equal(
			resizeLayerBox(redaction, moved, 30, 20)?.transform.x,
			moved.x,
		);
	});

	test("takes a line's width as its length, and turns it", () => {
		const turned = { ...moved, rotation: 1 };
		const line = resizeLayerBox(arrow(), turned, 250, 30) as ShapeLayer;
		assert.equal(line.shape === "arrow" && line.length, 250);
		assert.equal(line.transform.rotation, 1);
	});

	test("is null for no change, an empty box, or a layer without a box", () => {
		const shape = rectangle();
		assert.equal(resizeLayerBox(shape, shape.transform, 200, 100), null);
		assert.equal(resizeLayerBox(shape, moved, 0, 100), null);
		const text = createTextLayer(landscape(), "text");
		assert.equal(resizeLayerBox(text, moved, 200, 100), null);
	});
});

describe("reorderLayer", () => {
	// The photo plus text layers named a, b, c, bottom to top.
	const stack = (): EditorDocument["layers"] => {
		const document = landscape();
		return [
			...document.layers,
			...["a", "b", "c"].map((id) => ({
				...createTextLayer(document, id),
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
