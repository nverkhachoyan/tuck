/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	addMaskStroke,
	imagePointAt,
	isCutOut,
	withInvertedCut,
	withMask,
} from "./cutout.ts";
import { createDocumentFromImage, type ImageLayer } from "./document.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true)
		.layers[0] as ImageLayer;

describe("withMask", () => {
	test("sets a mask, and leaves the layer be when it's the same", () => {
		const cut = withMask(photo(), "file:///mask.png");
		assert.equal(cut.mask, "file:///mask.png");
		assert.equal(withMask(cut, "file:///mask.png"), cut);
	});

	test("takes the mask back off, leaving no trace of it", () => {
		const layer = photo();
		assert.equal(withMask(layer, null), layer);
		const restored = withMask(withMask(layer, "file:///mask.png"), null);
		assert.equal("mask" in restored, false);
		assert.deepEqual(restored, layer);
	});

	test("drops strokes that refined the cut before", () => {
		const refined = addMaskStroke(withMask(photo(), "file:///a.png"), {
			type: "eraser",
			width: 10,
			points: [2000, 1500],
		});
		const recut = withMask(refined, "file:///a.png");
		assert.equal(recut.mask, "file:///a.png");
		assert.equal("maskStrokes" in recut, false);
		assert.deepEqual(withMask(refined, null), photo());
	});

	test("keeps the strokes when asked, for a mask grown from the old one", () => {
		const refined = addMaskStroke(withMask(photo(), "file:///a.png"), {
			type: "eraser",
			width: 10,
			points: [2000, 1500],
		});
		const grown = withMask(refined, "file:///b.png", { keepStrokes: true });
		assert.equal(grown.mask, "file:///b.png");
		assert.deepEqual(grown.maskStrokes, refined.maskStrokes);
		assert.equal(
			withMask(refined, "file:///a.png", { keepStrokes: true }),
			refined,
		);
		assert.equal(
			"maskStrokes" in
				withMask(photo(), "file:///b.png", {
					keepStrokes: true,
				}),
			false,
		);
	});
});

describe("withInvertedCut", () => {
	test("takes the inverted mask, and paints every stroke the other way", () => {
		const erased = addMaskStroke(withMask(photo(), "file:///a.png"), {
			type: "eraser",
			width: 10,
			feather: 2,
			points: [2000, 1500],
		});
		const refined = addMaskStroke(erased, {
			type: "pen",
			width: 20,
			points: [2100, 1500],
		});
		const inverted = withInvertedCut(refined, "file:///b.png");
		assert.equal(inverted.mask, "file:///b.png");
		assert.deepEqual(
			inverted.maskStrokes,
			refined.maskStrokes?.map((stroke) => ({
				...stroke,
				type: stroke.type === "pen" ? "eraser" : "pen",
			})),
		);
		assert.equal(inverted.maskStrokes?.[0].feather, 2);
		assert.deepEqual(
			withInvertedCut(inverted, "file:///a.png").maskStrokes,
			refined.maskStrokes,
		);
	});

	test("gives a cut made only by hand its mask", () => {
		const erased = addMaskStroke(photo(), {
			type: "eraser",
			width: 10,
			points: [2000, 1500],
		});
		const inverted = withInvertedCut(erased, "file:///black.png");
		assert.equal(inverted.mask, "file:///black.png");
		assert.equal(inverted.maskStrokes?.[0].type, "pen");
	});

	test("adds no strokes to a cut without them", () => {
		const inverted = withInvertedCut(
			withMask(photo(), "file:///a.png"),
			"file:///b.png",
		);
		assert.equal(inverted.mask, "file:///b.png");
		assert.equal("maskStrokes" in inverted, false);
	});
});

describe("addMaskStroke", () => {
	test("paints in the image's own pixels, centered on its middle", () => {
		const layer = addMaskStroke(photo(), {
			type: "pen",
			width: 40,
			points: [2000, 1500, 2100, 1400],
		});
		assert.deepEqual(layer.maskStrokes, [
			{ type: "pen", width: 40, points: [0, 0, 100, -100] },
		]);
		assert.equal(isCutOut(layer), true);
	});

	test("scales a feather with the width, and leaves a hard edge without", () => {
		const layer: ImageLayer = {
			...photo(),
			transform: { ...photo().transform, scaleX: 2, scaleY: 2 },
		};
		const [soft] =
			addMaskStroke(layer, {
				type: "pen",
				width: 40,
				feather: 6,
				points: [0, 0],
			}).maskStrokes ?? [];
		assert.equal(soft.width, 20);
		assert.equal(soft.feather, 3);
		const [hard] =
			addMaskStroke(layer, { type: "pen", width: 40, points: [0, 0] })
				.maskStrokes ?? [];
		assert.equal("feather" in hard, false);
	});

	test("follows the layer however it's placed, and flipped", () => {
		const layer: ImageLayer = {
			...photo(),
			flipped: true,
			transform: {
				x: 100,
				y: 200,
				rotation: Math.PI / 2,
				scaleX: 2,
				scaleY: 2,
			},
		};
		// Turned a quarter, a step right on the canvas is a step up the image;
		// flipped, a step left in it.
		const painted = addMaskStroke(layer, {
			type: "eraser",
			width: 40,
			points: [100, 200, 120, 200],
		});
		assert.deepEqual(painted.maskStrokes, [
			{ type: "eraser", width: 20, points: [0, 0, 0, -10] },
		]);
		const more = addMaskStroke(painted, {
			type: "pen",
			width: 40,
			points: [100, 220],
		});
		assert.equal(more.maskStrokes?.length, 2);
		assert.deepEqual(more.maskStrokes?.[1].points, [-10, 0]);
	});
});

describe("imagePointAt", () => {
	test("is a fraction of the image, from its top left, or null off it", () => {
		const layer = photo();
		assert.deepEqual(imagePointAt(layer, { x: 1000, y: 2250 }), {
			x: 0.25,
			y: 0.75,
		});
		assert.equal(imagePointAt(layer, { x: -10, y: 100 }), null);
	});

	test("follows a turned, scaled, flipped layer", () => {
		const layer: ImageLayer = {
			...photo(),
			flipped: true,
			transform: { x: 0, y: 0, rotation: Math.PI, scaleX: 0.5, scaleY: 0.5 },
		};
		// Turned half around, its top left is at the bottom right, and flipped,
		// at the bottom left.
		const point = imagePointAt(layer, { x: -999, y: 749 });
		assert.ok(point && point.x < 0.001 && point.y < 0.001, String(point));
	});
});

describe("isCutOut", () => {
	test("is cut by a mask, by strokes, or by both", () => {
		const layer = photo();
		assert.equal(isCutOut(layer), false);
		assert.equal(isCutOut(withMask(layer, "file:///a.png")), true);
	});
});
