/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	type EditorDocument,
	hasEdits,
} from "../model/document.ts";
import {
	documentFraming,
	framingsEqual,
	reframeDocument,
} from "../model/framing.ts";
import {
	boxWithRatio,
	type CropDragLimits,
	type CropState,
	cropAngle,
	cropFraming,
	cropHandleAt,
	cropsEqual,
	cropViewBounds,
	dragCrop,
	flipCrop,
	isBoxOnPhoto,
	resetCrop,
	rotateLeft,
	SNAP,
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
	createDocumentFromImage("file:///photo.jpg", 4000, 3000);

// Applies a finished crop the way the crop tool's Done does.
function applyCrop(document: EditorDocument, state: CropState) {
	const framing = cropFraming(state, photo, 1, document.background);
	return reframeDocument(document, framing, false);
}

const limits = (overrides: Partial<CropDragLimits> = {}): CropDragLimits => ({
	photo,
	angle: 0,
	ratio: null,
	minSize: 100,
	bounds: { x: -5000, y: -5000, width: 10000, height: 10000 },
	tolerance: 50,
	...overrides,
});

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

describe("dragCrop", () => {
	const whole = resetCrop(photo).box;

	test("moves one edge for a side, two for a corner", () => {
		const { box } = dragCrop(whole, "right", -500, 999, limits());
		assert.deepEqual(box, { ...whole, width: 3500 });
		const corner = dragCrop(whole, "top-left", 300, 200, limits()).box;
		assert.deepEqual(corner, { x: -1700, y: -1300, width: 3700, height: 2800 });
	});

	test("snaps an edge onto the photo's, and past it expands the canvas", () => {
		const cropped = { ...whole, width: 3000 };
		const snapped = dragCrop(cropped, "right", 980, 0, limits());
		assert.equal(snapped.box.width, 4000);
		assert.equal(snapped.snapped, SNAP.right);
		const expanded = dragCrop(cropped, "right", 1300, 0, limits());
		assert.equal(expanded.box.width, 4300);
		assert.equal(expanded.snapped, 0);
	});

	test("snaps onto a straightened photo's edge where both corners fit", () => {
		const angle = 0.1;
		const inside = straightenTo(resetCrop(photo), angle, photo).box;
		const { box, snapped } = dragCrop(
			{ ...inside, width: inside.width - 30 },
			"right",
			40,
			0,
			limits({ angle }),
		);
		assert.equal(snapped, SNAP.right);
		assert.ok(isBoxOnPhoto(box, photo, angle));
		near(box.width, inside.width, 1e-6);
	});

	test("keeps a minimum size, and stays in bounds", () => {
		const shrunk = dragCrop(whole, "right", -9000, 0, limits()).box;
		assert.equal(shrunk.width, 100);
		const bounds = { x: -2500, y: -2000, width: 5000, height: 4000 };
		const grown = dragCrop(whole, "right", 9000, 0, limits({ bounds })).box;
		assert.equal(grown.x + grown.width, 2500);
	});

	test("moving snaps the box's edges or center onto the photo's", () => {
		const small = { x: -500, y: -400, width: 1000, height: 800 };
		const centered = dragCrop(small, "move", 30, -20, limits());
		assert.equal(centered.box.x, -500);
		assert.equal(centered.box.y, -400);
		assert.equal(centered.snapped, SNAP.centerX | SNAP.centerY);
		const edge = dragCrop(small, "move", 1480, 0, limits()).box;
		assert.equal(edge.x + edge.width, 2000);
	});

	test("a locked ratio scales from the opposite corner", () => {
		const square = { x: -1000, y: -1000, width: 2000, height: 2000 };
		const { box } = dragCrop(
			square,
			"bottom-right",
			300,
			100,
			limits({ ratio: 1, tolerance: 0 }),
		);
		assert.equal(box.x, -1000);
		assert.equal(box.y, -1000);
		assert.equal(box.width, box.height);
		assert.equal(box.width, 2200);
	});

	test("a locked ratio's side grows both ways about the middle", () => {
		const square = { x: -1000, y: -1000, width: 2000, height: 2000 };
		const { box } = dragCrop(
			square,
			"right",
			200,
			0,
			limits({ ratio: 1, tolerance: 0 }),
		);
		assert.deepEqual(box, { x: -1000, y: -1100, width: 2200, height: 2200 });
	});

	test("a locked ratio snaps whichever moving edge reaches the photo's", () => {
		const square = { x: -1500, y: -1500, width: 3000, height: 3000 };
		const { box, snapped } = dragCrop(
			square,
			"bottom-right",
			470,
			470,
			limits({ ratio: 1 }),
		);
		assert.equal(snapped, SNAP.right);
		assert.equal(box.x + box.width, 2000);
		assert.equal(box.width, box.height);
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

describe("cropHandleAt", () => {
	const edges = { left: 100, top: 100, right: 300, bottom: 400 };

	test("finds corners, sides, and the middle", () => {
		assert.equal(cropHandleAt(edges, { x: 95, y: 98 }, 20), "top-left");
		assert.equal(cropHandleAt(edges, { x: 310, y: 250 }, 20), "right");
		assert.equal(cropHandleAt(edges, { x: 200, y: 405 }, 20), "bottom");
		assert.equal(cropHandleAt(edges, { x: 200, y: 250 }, 20), "move");
		assert.equal(cropHandleAt(edges, { x: 50, y: 250 }, 20), null);
	});

	test("leaves a small box's middle for moving it", () => {
		const small = { left: 100, top: 100, right: 140, bottom: 140 };
		assert.equal(cropHandleAt(small, { x: 120, y: 120 }, 22), "move");
		assert.equal(cropHandleAt(small, { x: 90, y: 120 }, 22), "left");
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
