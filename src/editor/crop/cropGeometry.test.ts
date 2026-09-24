/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
	createTextLayer,
	type EditorDocument,
	hasEdits,
} from "../../model/document.ts";
import {
	documentFraming,
	framingsEqual,
	reframeDocument,
} from "../../model/framing.ts";
import {
	boxWithRatio,
	type CropState,
	cropAngle,
	cropFraming,
	cropsEqual,
	cropViewBounds,
	flipCrop,
	isBoxOnPhoto,
	resetCrop,
	rotateLeft,
	startCrop,
	straightenTo,
} from "./cropGeometry.ts";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
	assert.ok(
		Math.abs(actual - expected) < tolerance,
		`expected ${actual} to be ${expected}`,
	);

const photo = { width: 4000, height: 3000 };
const landscape = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

// Applies a finished crop the way the crop tool's Done does.
function applyCrop(document: EditorDocument, state: CropState) {
	const framing = cropFraming(state, photo, 1, document.background);
	return reframeDocument(document, framing, false);
}

describe("startCrop", () => {
	test("starts a new document at the whole photo", () => {
		assert.deepEqual(startCrop(landscape()), resetCrop(photo));
	});

	test("reproduces a crop that was applied", () => {
		const state: CropState = {
			...rotateLeft(resetCrop(photo)),
			box: { x: -1000, y: -1500, width: 2000, height: 2500 },
		};
		assert.deepEqual(startCrop(applyCrop(landscape(), state)), state);
	});

	test("starts a canvas without a photo at the whole canvas", () => {
		const canvas = { width: 1080, height: 1920 };
		const document = createBlankDocument(1080, 1920, null);
		assert.deepEqual(startCrop(document), resetCrop(canvas));

		// Turned, the canvas stands in afresh: nothing is left to remember.
		document.layers.push(createTextLayer(document, "HI", "center"));
		const framing = cropFraming(
			rotateLeft(startCrop(document)),
			canvas,
			1,
			null,
		);
		const turned = reframeDocument(document, framing, false);
		assert.equal(turned.width, 1920);
		assert.equal(turned.height, 1080);
		assert.deepEqual(
			startCrop(turned),
			resetCrop({ width: 1920, height: 1080 }),
		);
	});
});

describe("cropFraming", () => {
	test("leaves an untouched crop as the original photo", () => {
		const document = landscape();
		const framing = cropFraming(startCrop(document), photo, 1, null);
		assert.ok(framingsEqual(framing, documentFraming(document)));
	});

	test("sizes the canvas to the box, with the photo placed under it", () => {
		const framing = cropFraming(
			{
				...resetCrop(photo),
				box: { x: 0, y: -1500, width: 2000, height: 1000 },
			},
			photo,
			1,
			null,
		);
		assert.equal(framing.width, 2000);
		assert.equal(framing.height, 1000);
		assert.equal(framing.transform.x, 0);
		assert.equal(framing.transform.y, 1500);
	});

	test("rounds a crop on the photo inward to whole pixels", () => {
		const framing = cropFraming(
			{
				...resetCrop(photo),
				box: { x: -1999.6, y: -1500, width: 3999.2, height: 3000 },
			},
			photo,
			1,
			null,
		);
		// From 0.4 to 3999.6 in the photo's pixels: 1 to 3999.
		assert.equal(framing.width, 3998);
		assert.equal(framing.transform.x, 1999);
	});

	test("rounds a canvas reaching past the photo to the nearest pixel", () => {
		const framing = cropFraming(
			{
				...resetCrop(photo),
				box: { x: -2000, y: -1800.4, width: 4000, height: 3600.8 },
			},
			photo,
			1,
			"#FFFFFF",
		);
		// Each edge rounds on its own: from -300.4 to 3300.4 is -300 to 3300.
		assert.equal(framing.height, 3600);
		assert.equal(framing.transform.y, 1800);
		assert.equal(framing.background, "#FFFFFF");
	});
});

describe("rotateLeft and flipCrop", () => {
	test("four turns, or two flips, come back to where they started", () => {
		const start: CropState = {
			...resetCrop(photo),
			straighten: 0.1,
			box: { x: -300, y: -200, width: 500, height: 400 },
		};
		let turned = start;
		for (let i = 0; i < 4; i++) turned = rotateLeft(turned);
		assert.deepEqual(turned, start);
		assert.deepEqual(flipCrop(flipCrop(start)), start);
	});

	test("a turn left takes the top-left corner to the bottom-left", () => {
		const document = applyCrop(landscape(), rotateLeft(resetCrop(photo)));
		assert.equal(document.width, 3000);
		assert.equal(document.height, 4000);
		assert.deepEqual(documentFraming(document).transform, {
			x: 1500,
			y: 2000,
			scaleX: 1,
			scaleY: 1,
			rotation: -Math.PI / 2,
		});
	});

	test("turning and flipping back leaves no edit", () => {
		let state = resetCrop(photo);
		for (let i = 0; i < 4; i++) state = rotateLeft(state);
		// Flipped, a turn left is a turn right.
		state = rotateLeft(flipCrop(rotateLeft(flipCrop(state))));
		assert.equal(hasEdits(applyCrop(landscape(), state)), false);
	});
});

describe("straightenTo", () => {
	test("shrinks a box on the photo to keep it there", () => {
		const start = resetCrop(photo);
		const straightened = straightenTo(start, 0.1, photo);
		assert.ok(straightened.box.width < photo.width);
		assert.ok(isBoxOnPhoto(straightened.box, photo, cropAngle(straightened)));
		// Only just: any bigger and a corner would come off.
		const bigger = {
			...straightened.box,
			width: straightened.box.width * 1.01,
		};
		assert.ok(!isBoxOnPhoto(bigger, photo, cropAngle(straightened), 0));
	});

	test("comes back exactly to where the dial was grabbed", () => {
		const start = straightenTo(resetCrop(photo), 0.1, photo);
		const there = straightenTo(start, -0.3, photo);
		assert.ok(cropsEqual(straightenTo(start, 0.1, photo), start));
		assert.ok(there.box.width < start.box.width);
	});

	test("turns an expanded canvas without shrinking it", () => {
		const start: CropState = {
			...resetCrop(photo),
			box: { x: -2000, y: -2000, width: 4000, height: 4000 },
		};
		const straightened = straightenTo(start, 0.2, photo);
		near(straightened.box.width, 4000);
		near(straightened.box.height, 4000);
	});
});

describe("boxWithRatio", () => {
	test("is the largest box of the ratio inside, centered", () => {
		assert.deepEqual(boxWithRatio(resetCrop(photo).box, 1), {
			x: -1500,
			y: -1500,
			width: 3000,
			height: 3000,
		});
		const wide = boxWithRatio(resetCrop(photo).box, 16 / 9);
		assert.equal(wide.width, 4000);
		near(wide.height, 2250);
	});
});

describe("cropViewBounds", () => {
	test("covers the turned photo and the box", () => {
		const turned = rotateLeft(resetCrop(photo));
		assert.deepEqual(cropViewBounds(turned, photo), {
			x: -1500,
			y: -2000,
			width: 3000,
			height: 4000,
		});
		const expanded = {
			...turned,
			box: { x: -1500, y: -2600, width: 3000, height: 4600 },
		};
		assert.equal(cropViewBounds(expanded, photo).y, -2600);
	});

	test("covers photo corners added by straightening", () => {
		const state = { ...resetCrop(photo), straighten: Math.PI / 4 };
		const bounds = cropViewBounds(state, photo);
		const side = (photo.width + photo.height) / Math.sqrt(2);
		near(bounds.x, -side / 2);
		near(bounds.y, -side / 2);
		near(bounds.width, side);
		near(bounds.height, side);
	});
});
