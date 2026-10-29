/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createImageLayer, type ImageLayer } from "../../layers/image/image.ts";
import type { Layer } from "../../layers/layer.ts";
import { createRedactionBox } from "../../layers/redaction/redaction.ts";
import { createTextLayer } from "../../layers/text/text.ts";
import {
	createBlankDocument,
	createDocumentFromImage,
	type EditorDocument,
} from "../document.ts";
import {
	documentFraming,
	type Framing,
	framingAnchor,
	framingsEqual,
	rebaseTransform,
	reframeDocument,
	targetImageLayer,
	visibleImageLayer,
} from "../framing.ts";
import { normalizeAngle, type Transform } from "../geometry.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be ${expected}`,
	);

// A 4000×3000 photo with text near its top-left corner, tilted a little.
function documentWithText(): EditorDocument {
	const document = createDocumentFromImage(
		"file:///photo.jpg",
		4000,
		3000,
		true,
	);
	const text = createTextLayer(document, "TOP TEXT");
	text.transform = { ...text.transform, x: 1000, y: 500, rotation: 0.2 };
	document.layers.push(text);
	return document;
}

const photoLayer = (document: EditorDocument) =>
	document.layers[0] as ImageLayer;
const text = (document: EditorDocument): Layer => document.layers[1];

// The whole canvas turned a quarter turn counterclockwise: what was at the
// top-left ends up at the bottom-left.
function turnLeft(document: EditorDocument): Framing {
	const framing = documentFraming(document);
	const { x, y, rotation } = framing.transform;
	return {
		...framing,
		width: document.height,
		height: document.width,
		transform: {
			...framing.transform,
			x: y,
			y: document.width - x,
			rotation: normalizeAngle(rotation - Math.PI / 2),
		},
	};
}

describe("reframeDocument", () => {
	test("crops by moving the photo, keeping text over the same spot", () => {
		const document = documentWithText();
		// The right half of the photo.
		const framing: Framing = {
			...documentFraming(document),
			width: 2000,
			transform: { ...photoLayer(document).transform, x: 0 },
		};
		const cropped = reframeDocument(document, framing, false);
		assert.equal(cropped.width, 2000);
		assert.equal(cropped.height, 3000);
		assert.equal(photoLayer(cropped).transform.x, 0);
		assert.equal(text(cropped).transform.x, -1000);
		assert.equal(text(cropped).transform.y, 500);
	});

	test("turns text's position with the photo, but keeps it level", () => {
		const document = documentWithText();
		const turned = reframeDocument(document, turnLeft(document), false);
		assert.equal(turned.width, 3000);
		assert.equal(turned.height, 4000);
		assert.deepEqual(text(turned).transform, {
			...text(document).transform,
			x: 500,
			y: 3000,
		});
	});

	test("turns text too when asked", () => {
		const document = documentWithText();
		const turned = reframeDocument(document, turnLeft(document), true);
		near(text(turned).transform.rotation, 0.2 - Math.PI / 2);
	});

	test("always turns a redaction with the photo, so it keeps covering", () => {
		const document = documentWithText();
		const box = createRedactionBox(
			{ x: 900, y: 450, width: 200, height: 100 },
			{ type: "solid", color: "#000000" },
		);
		document.layers.push(box);
		const turned = reframeDocument(document, turnLeft(document), false);
		near(turned.layers[2].transform.rotation, -Math.PI / 2);
		near(text(turned).transform.rotation, 0.2);
	});

	test("comes back exactly after four quarter turns", () => {
		for (const turnLayers of [false, true]) {
			const document = documentWithText();
			let turned = document;
			for (let i = 0; i < 4; i++) {
				turned = reframeDocument(turned, turnLeft(turned), turnLayers);
			}
			assert.deepEqual(turned.layers[0], document.layers[0]);
			// Text that turned along is only as exact as adding its angle up.
			const { rotation, ...rest } = text(turned).transform;
			near(rotation, 0.2);
			assert.deepEqual(
				{ ...text(turned), transform: { ...rest, rotation: 0.2 } },
				text(document),
			);
		}
	});

	test("flipping mirrors where text sits, but never its letters", () => {
		const document = documentWithText();
		const framing = { ...documentFraming(document), flipped: true };
		for (const turnLayers of [false, true]) {
			const flipped = reframeDocument(document, framing, turnLayers);
			const { transform } = text(flipped);
			assert.equal(photoLayer(flipped).flipped, true);
			assert.equal(transform.x, 3000);
			assert.equal(transform.y, 500);
			assert.ok(transform.scaleX > 0 && transform.scaleY > 0);
			near(transform.rotation, turnLayers ? -0.2 : 0.2);
		}
	});

	test("scales text along with the photo", () => {
		const document = documentWithText();
		const photo = photoLayer(document).transform;
		const framing = {
			...documentFraming(document),
			width: 2000,
			height: 1500,
			transform: { ...photo, x: 1000, y: 750, scaleX: 0.5, scaleY: 0.5 },
		};
		const halved = reframeDocument(document, framing, false);
		const before = text(document).transform;
		assert.deepEqual(text(halved).transform, {
			...before,
			x: 500,
			y: 250,
			scaleX: before.scaleX / 2,
			scaleY: before.scaleY / 2,
		});
	});

	test("sets the canvas's background, leaving layers alone", () => {
		const document = documentWithText();
		document.layers[0].transform.rotation = 0.3;
		const framing = { ...documentFraming(document), background: "#FFFFFF" };
		const filled = reframeDocument(document, framing, true);
		assert.equal(filled.background, "#FFFFFF");
		assert.equal(filled.layers, document.layers);
	});
});

describe("framingAnchor", () => {
	test("is the lowest visible locked image, wherever it is in the stack", () => {
		const document = documentWithText();
		assert.equal(framingAnchor(document).layer, document.layers[0]);
		const reordered = { ...document, layers: document.layers.toReversed() };
		assert.equal(framingAnchor(reordered).layer, document.layers[0]);
	});

	test("passes over unlocked images: added photos follow the canvas", () => {
		const document = documentWithText();
		const added = createImageLayer(
			document,
			"file:///added.jpg",
			400,
			300,
			true,
		);
		document.layers.unshift(added);
		assert.equal(framingAnchor(document).layer, document.layers[1]);

		const blank = createBlankDocument(1080, 1080, "#FFFFFF");
		blank.layers.push(
			createImageLayer(blank, "file:///added.jpg", 400, 300, true),
		);
		assert.equal(framingAnchor(blank).layer, null);
		blank.layers[0].locked = true;
		assert.equal(framingAnchor(blank).layer, blank.layers[0]);
	});

	test("is the canvas once the photo is unlocked", () => {
		const document = documentWithText();
		document.layers[0].locked = false;
		assert.equal(framingAnchor(document).layer, null);
	});

	test("is the canvas, centered on itself, with no visible image", () => {
		const document = documentWithText();
		document.layers[0].hidden = true;
		assert.deepEqual(framingAnchor(document), {
			layer: null,
			width: 4000,
			height: 3000,
			transform: { x: 2000, y: 1500, scaleX: 1, scaleY: 1, rotation: 0 },
			flipped: false,
		});
	});
});

describe("reframing a canvas without a photo", () => {
	function blankWithText(): EditorDocument {
		const document = createBlankDocument(1080, 1920, "#FFFFFF");
		const caption = createTextLayer(document, "CAPTION");
		caption.transform = { ...caption.transform, x: 540, y: 200 };
		document.layers.push(caption);
		return document;
	}

	test("crops the canvas, keeping text over the same spot", () => {
		const document = blankWithText();
		// The top half.
		const framing: Framing = {
			...documentFraming(document),
			height: 960,
		};
		const cropped = reframeDocument(document, framing, false);
		assert.equal(cropped.height, 960);
		assert.deepEqual(cropped.layers[0].transform, {
			...document.layers[0].transform,
			y: 200,
		});
	});

	test("moves an unlocked photo along like any layer", () => {
		const document = blankWithText();
		const added = createImageLayer(
			document,
			"file:///added.jpg",
			400,
			300,
			true,
		);
		document.layers.push(added);
		// The bottom half.
		const current = documentFraming(document);
		const framing: Framing = {
			...current,
			height: 960,
			transform: { ...current.transform, y: 0 },
		};
		const cropped = reframeDocument(document, framing, false);
		assert.deepEqual(cropped.layers[1].transform, {
			...added.transform,
			y: 0,
		});
	});

	test("turns text's position with the canvas", () => {
		const document = blankWithText();
		const turned = reframeDocument(document, turnLeft(document), false);
		assert.equal(turned.width, 1920);
		assert.equal(turned.height, 1080);
		assert.equal(turned.layers[0].transform.x, 200);
		assert.equal(turned.layers[0].transform.y, 540);
		// The next framing starts from the turned canvas.
		assert.deepEqual(documentFraming(turned).transform, {
			x: 960,
			y: 540,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
	});
});

describe("rebaseTransform", () => {
	test("leaves a layer alone when the photo doesn't move", () => {
		const photo = { transform: photoLayer(documentWithText()).transform };
		const placement = { ...photo, flipped: false };
		const transform: Transform = {
			x: 12,
			y: 34,
			scaleX: 2,
			scaleY: 2,
			rotation: 0.5,
		};
		assert.deepEqual(
			rebaseTransform(transform, placement, placement, true),
			transform,
		);
	});
});

describe("framingsEqual", () => {
	test("notices any change", () => {
		const framing = documentFraming(documentWithText());
		assert.ok(framingsEqual(framing, { ...framing }));
		assert.ok(!framingsEqual(framing, { ...framing, width: 1 }));
		assert.ok(!framingsEqual(framing, { ...framing, flipped: true }));
		assert.ok(!framingsEqual(framing, { ...framing, background: "#000000" }));
		assert.ok(
			!framingsEqual(framing, {
				...framing,
				transform: { ...framing.transform, rotation: 1 },
			}),
		);
	});
});

describe("targetImageLayer", () => {
	test("prefers a selected visible image layer", () => {
		const document = documentWithText();
		const sticker = createImageLayer(
			document,
			"file:///sticker.png",
			200,
			200,
			false,
		);
		document.layers.push(sticker);
		assert.equal(targetImageLayer(document, sticker), sticker);
	});

	test("ignores a selected hidden image layer", () => {
		const document = documentWithText();
		const sticker = {
			...createImageLayer(document, "file:///sticker.png", 200, 200, false),
			hidden: true,
		};
		document.layers.push(sticker);
		assert.equal(targetImageLayer(document, sticker), photoLayer(document));
	});

	test("falls back to the locked framing photo when text is selected", () => {
		const document = documentWithText();
		assert.equal(
			targetImageLayer(document, text(document)),
			photoLayer(document),
		);
	});

	test("falls back to the first visible image when none is locked", () => {
		const blank = createBlankDocument(800, 600, "#FFFFFF");
		const first = createImageLayer(blank, "file:///1.jpg", 400, 300, true);
		const second = createImageLayer(blank, "file:///2.jpg", 400, 300, true);
		blank.layers.push(first, second);
		assert.equal(targetImageLayer(blank, undefined), first);
	});

	test("returns null when the document has no visible images", () => {
		const blank = createBlankDocument(800, 600, "#FFFFFF");
		const heading = createTextLayer(blank, "Hello");
		blank.layers.push(heading);
		assert.equal(targetImageLayer(blank, heading), null);
		assert.equal(targetImageLayer(blank, undefined), null);
	});
});

describe("visibleImageLayer", () => {
	test("finds a visible image by id and ignores hidden or non-image layers", () => {
		const document = documentWithText();
		const photo = photoLayer(document);
		assert.equal(visibleImageLayer(document, photo.id), photo);
		assert.equal(visibleImageLayer(document, text(document).id), undefined);
		photo.hidden = true;
		assert.equal(visibleImageLayer(document, photo.id), undefined);
	});
});
