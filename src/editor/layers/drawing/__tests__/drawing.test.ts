/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createDrawingLayer,
	isDrawingLayer,
	layerBlend,
	type Stroke,
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
