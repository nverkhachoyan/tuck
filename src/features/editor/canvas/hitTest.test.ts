/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type {
	DrawingLayer,
	RedactionStrokes,
} from "../../../model/document.ts";
import type { Transform } from "../../../model/geometry.ts";
import { findLayerAt, type LayerTarget } from "./hitTest.ts";

const at = (x: number, y: number): Transform => ({
	x,
	y,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
});

// A 100×100 box centered on (x, y).
function target(
	id: string,
	x: number,
	y: number,
	options: {
		locked?: boolean;
		strokes?: DrawingLayer["strokes"] | RedactionStrokes["strokes"];
	} = {},
): LayerTarget {
	const box = { halfWidth: 50, halfHeight: 50 };
	return {
		id,
		transform: at(x, y),
		box,
		hitBox: options.locked ? null : box,
		hitPadding: 0,
		strokes: options.strokes ?? null,
		clipped: false,
	};
}

// A horizontal line across the middle of a 100×100 drawing.
const line: DrawingLayer = {
	id: "drawing",
	type: "drawing",
	transform: at(0, 0),
	hidden: false,
	locked: false,
	strokes: [
		{ type: "pen", color: "#000000", width: 10, points: [-50, 0, 50, 0] },
	],
};

describe("findLayerAt", () => {
	test("picks the topmost layer under the point", () => {
		const targets = [target("bottom", 0, 0), target("top", 40, 0)];
		assert.equal(findLayerAt(targets, { x: 20, y: 0 })?.id, "top");
		assert.equal(findLayerAt(targets, { x: -40, y: 0 })?.id, "bottom");
	});

	test("finds nothing outside every layer", () => {
		assert.equal(findLayerAt([target("only", 0, 0)], { x: 80, y: 0 }), null);
		assert.equal(findLayerAt([], { x: 0, y: 0 }), null);
	});

	test("reaches through a locked layer to the one under it", () => {
		const targets = [
			target("bottom", 0, 0),
			target("locked", 0, 0, { locked: true }),
		];
		assert.equal(findLayerAt(targets, { x: 0, y: 0 })?.id, "bottom");
	});

	test("hits a drawing only near what it drew", () => {
		const targets = [
			target("photo", 0, 0),
			target("drawing", 0, 0, { strokes: line.strokes }),
		];
		assert.equal(findLayerAt(targets, { x: 10, y: 2 })?.id, "drawing");
		assert.equal(findLayerAt(targets, { x: 10, y: 30 })?.id, "photo");
	});

	test("hits a brushed redaction only near its pens, as a drawing", () => {
		const targets = [
			target("photo", 0, 0),
			target("redaction", 0, 0, {
				strokes: [{ type: "pen", width: 10, points: [-50, 0, 50, 0] }],
			}),
		];
		assert.equal(findLayerAt(targets, { x: 10, y: 2 })?.id, "redaction");
		assert.equal(findLayerAt(targets, { x: 10, y: 30 })?.id, "photo");
	});
});
