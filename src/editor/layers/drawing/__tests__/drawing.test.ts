/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createDrawingLayer,
	inkRect,
	isDrawingLayer,
	layerBlend,
	markStyle,
	needsOwnLayer,
	pruneErased,
	type Stroke,
	visibleReach,
} from "../drawing.ts";

const pen: Stroke & { type: "pen" } = {
	type: "pen",
	color: "#ff0000",
	width: 8,
	points: [0, 0, 10, 0],
};

test("a highlighter layer multiplies, and another tip does not", () => {
	assert.equal(
		createDrawingLayer({ ...pen, color: "#FFD60A", tip: "marker" }).blend,
		"multiply",
	);
	assert.equal(createDrawingLayer(pen).blend, undefined);
	assert.equal(createDrawingLayer({ ...pen, tip: "ink" }).blend, undefined);
});

test("keeps a drawing whose blend it doesn't know, and draws it normally", () => {
	const layer = createDrawingLayer(pen);
	const unknown = { ...layer, blend: "screen" };
	assert.equal(isDrawingLayer(unknown), true);
	assert.equal(layerBlend(unknown), undefined);
	assert.equal(isDrawingLayer({ ...layer, blend: "multiply" }), true);
	assert.equal(layerBlend({ blend: "multiply" }), "multiply");
	const { blend: _blend, ...without } = {
		...layer,
		blend: "multiply" as const,
	};
	assert.equal(isDrawingLayer(without), true);
	assert.equal(layerBlend({ blend: undefined }), undefined);
});

test("a pen's ink reaches half its width, a square end's corner, or a neon glow", () => {
	assert.equal(visibleReach(pen), 4);
	assert.equal(
		visibleReach({ ...pen, width: 10, tip: "marker" }),
		10 * Math.SQRT1_2,
	);
	assert.equal(
		visibleReach({ ...pen, width: 10, tip: "ink" }),
		10 * Math.SQRT1_2,
	);
	const neon = visibleReach({ ...pen, width: 10, tip: "neon" });
	assert.ok(neon > 7 && neon < 8, `neon reaches ${neon}`);
	assert.equal(visibleReach({ type: "eraser", width: 10 }), 5);
});

const line = (
	points: number[],
	width = 8,
	brush: Partial<Stroke & { type: "pen" }> = {},
): Stroke => ({ ...pen, ...brush, width, points });
const eraser = (points: number[], width: number): Stroke => ({
	type: "eraser",
	width,
	points,
});

test("pruneErased drops a pen erased entirely, then its now useless eraser", () => {
	const kept = line([0, 50, 100, 50]);
	const covered = line([0, 0, 100, 0]);
	const strokes = [kept, covered, eraser([-10, 0, 110, 0], 20)];
	assert.deepEqual(pruneErased(strokes), [kept]);
});

test("pruneErased keeps a pen erased in part, and the eraser that cut it", () => {
	const strokes = [line([0, 0, 100, 0]), eraser([-10, 0, 50, 0], 20)];
	assert.equal(pruneErased(strokes), strokes);
});

test("pruneErased keeps a neon stroke whose glow pokes past the eraser", () => {
	// 10 wide, its glow reaches about 7.6 from its middle: past an eraser
	// 14 across, though its width alone (5) is inside.
	const neon = line([0, 0, 100, 0], 10, { tip: "neon" });
	const strokes = [neon, eraser([-10, 0, 110, 0], 14)];
	assert.equal(pruneErased(strokes), strokes);
	assert.deepEqual(
		pruneErased([line([0, 0, 100, 0], 10), eraser([-10, 0, 110, 0], 14)]),
		[],
	);
});

test("pruneErased leaves a pen drawn after the eraser, and an eraser over nothing goes", () => {
	const later = line([0, 0, 100, 0]);
	assert.deepEqual(pruneErased([eraser([-10, 0, 110, 0], 20), later]), [later]);
});

test("only a drawing that multiplies or erases needs a saved layer", () => {
	const ink = createDrawingLayer(pen);
	assert.equal(needsOwnLayer(ink), false);
	assert.equal(
		needsOwnLayer(createDrawingLayer({ ...pen, tip: "marker" })),
		true,
	);
	assert.equal(
		needsOwnLayer({
			...ink,
			strokes: [...ink.strokes, { type: "eraser", width: 4, points: [0, 0] }],
		}),
		true,
	);
	// The see-through marker composites the same on the canvas.
	assert.equal(
		needsOwnLayer(createDrawingLayer({ ...pen, tip: "ink" })),
		false,
	);
});

test("a drawing's ink rectangle covers its box, its square ends, and its glow", () => {
	// A line from -5 to 5 across, 8 wide: the box reaches 9 by 4.
	const round = inkRect(createDrawingLayer(pen));
	assert.deepEqual(round, { x: -11, y: -6, width: 22, height: 12 });
	const square = inkRect(createDrawingLayer({ ...pen, tip: "marker" }));
	const neon = inkRect(createDrawingLayer({ ...pen, tip: "neon" }));
	for (const wider of [square, neon]) {
		assert.ok(wider.x < round.x && wider.width > round.width);
		assert.ok(-wider.y >= visibleReach({ ...pen, tip: "neon" }) - 1);
	}
});

test("a mark's style is its last pen stroke's", () => {
	const layer = createDrawingLayer(pen);
	layer.strokes.push(
		{ ...pen, color: "#00ff00", width: 3, tip: "neon" },
		{ type: "eraser", width: 4, points: [0, 0] },
	);
	assert.deepEqual(markStyle(layer), {
		type: "pen",
		color: "#00ff00",
		width: 3,
		tip: "neon",
	});
	assert.equal(markStyle({ ...layer, strokes: [] }), null);
});
