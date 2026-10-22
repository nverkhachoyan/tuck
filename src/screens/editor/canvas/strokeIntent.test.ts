/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CanvasTool } from "./EditorScene.tsx";
import { shapeFromDrag } from "./shapeDrag.ts";
import { strokeIntent } from "./strokeIntent.ts";

const size = { width: 1000, height: 800 };
const style = { color: "#FF3B30", strokeWidth: 8 };
const effect = { type: "solid", color: "#000000" } as const;
const pen: CanvasTool = {
	type: "draw",
	brush: { type: "pen", color: "#FF3B30", width: 10 },
};
const brush: CanvasTool = {
	type: "redactBrush",
	brush: { type: "pen", width: 40 },
	effect,
};
const box: CanvasTool = { type: "redactBox", effect };
const rectangle: CanvasTool = { type: "drawShape", shape: "rectangle", style };
const arrow: CanvasTool = { type: "drawShape", shape: "arrow", style };

describe("strokeIntent", () => {
	test("picks the color under the stroke's end", () => {
		assert.deepEqual(
			strokeIntent({ type: "pickColor" }, [10, 10, 30, 40], 1, size),
			{ type: "pick", point: { x: 30, y: 40 } },
		);
	});

	test("picks the subject under a tap, and leaves a drag be", () => {
		const pick: CanvasTool = { type: "pickSubject", layerId: "photo" };
		assert.deepEqual(strokeIntent(pick, [100, 200, 103, 202], 1, size), {
			type: "pick",
			point: { x: 100, y: 200 },
		});
		assert.deepEqual(strokeIntent(pick, [100, 200, 300, 400], 1, size), {
			type: "none",
		});
		const cut: CanvasTool = {
			type: "cutBrush",
			layerId: "photo",
			brush: { type: "eraser", width: 30 },
		};
		assert.deepEqual(strokeIntent(cut, [100, 200], 1, size), {
			type: "paint",
		});
	});

	test("takes a tap off the document as a tap away, with any tool", () => {
		for (const tool of [pen, box, rectangle]) {
			assert.deepEqual(strokeIntent(tool, [-20, 50, -18, 51], 1, size), {
				type: "tapAway",
				point: { x: -20, y: 50 },
			});
		}
	});

	test("paints a brush's strokes, even from off the document", () => {
		assert.deepEqual(strokeIntent(pen, [10, 10, 100, 100], 1, size), {
			type: "paint",
		});
		assert.deepEqual(strokeIntent(brush, [-20, 50, 100, 50], 1, size), {
			type: "paint",
		});
	});

	test("makes a box between the drag's ends, either way round", () => {
		assert.deepEqual(strokeIntent(box, [300, 200, 100, 150], 1, size), {
			type: "box",
			rect: { x: 100, y: 150, width: 200, height: 50 },
		});
	});

	test("makes a shape from the drag", () => {
		const start = { x: 100, y: 100 };
		const end = { x: 300, y: 250 };
		assert.deepEqual(strokeIntent(rectangle, [100, 100, 300, 250], 1, size), {
			type: "shape",
			placement: shapeFromDrag("rectangle", start, end),
		});
	});

	test("drops a box too thin to show, but keeps a line", () => {
		const flat = [100, 100, 300, 103];
		assert.deepEqual(strokeIntent(box, flat, 1, size), { type: "none" });
		assert.deepEqual(strokeIntent(rectangle, flat, 1, size), { type: "none" });
		assert.equal(strokeIntent(arrow, flat, 1, size).type, "shape");
	});

	test("takes a short drag as a tap that selects a box to restyle", () => {
		assert.deepEqual(strokeIntent(box, [100, 100, 103, 102], 1, size), {
			type: "select",
			point: { x: 100, y: 100 },
			kind: "redaction",
		});
		assert.deepEqual(strokeIntent(arrow, [100, 100, 103, 102], 1, size), {
			type: "select",
			point: { x: 100, y: 100 },
			kind: "shape",
		});
	});

	test("measures the tap slop on screen, so zoomed out a drag is a tap", () => {
		const drag = [100, 100, 140, 130];
		assert.equal(strokeIntent(box, drag, 1, size).type, "box");
		assert.equal(strokeIntent(box, drag, 0.1, size).type, "select");
	});
});
