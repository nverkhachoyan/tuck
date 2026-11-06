/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	type EditorDocument,
} from "../../../document/document.ts";
import { toDocumentSpace } from "../../../document/geometry.ts";
import { createImageLayer, createStickerLayer } from "../../image/image.ts";
import type { Layer } from "../../layer.ts";
import {
	createRedactionBox,
	createRedactionStrokes,
} from "../../redaction/redaction.ts";
import type { ShapeLayer } from "../../shape/shape.ts";
import { addShape } from "../../shape/shapeEdits.ts";
import { drawingBox } from "../../strokes.ts";
import { createTextLayer } from "../../text/text.ts";
import type { DrawingLayer, Stroke } from "../drawing.ts";
import { drawStroke, eraseStroke, removedLayers } from "../drawingEdits.ts";

const blank = () => createBlankDocument(400, 300, "#ffffff");
const pen: Stroke & { type: "pen" } = {
	type: "pen",
	color: "#ff0000",
	width: 8,
	points: [10, 10, 60, 60],
};
const style = { color: "#0000ff", strokeWidth: 4 };
const place = { x: 200, y: 150, rotation: 0, width: 100, height: 60 };

const top = <T>(document: EditorDocument) => document.layers.at(-1) as T;
const layerOf = (document: EditorDocument, id: string) =>
	document.layers.find((layer) => layer.id === id);
const eraserOf = (
	width: number,
	points: number[],
): Stroke & { type: "eraser" } => ({ type: "eraser", width, points });
// Two drawings from two Pen sessions, crossing in an X.
const twoSessions = () => {
	const first = drawStroke(blank(), null, pen);
	return drawStroke(first, null, { ...pen, points: [10, 60, 60, 10] });
};
const lastStroke = (layer: Layer | undefined) =>
	(layer as DrawingLayer).strokes.at(-1);

describe("drawStroke", () => {
	test("starts a drawing on top with a pen", () => {
		const drawing = top<DrawingLayer>(drawStroke(blank(), null, pen));
		assert.equal(drawing.type, "drawing");
		assert.equal(drawing.strokes.length, 1);
	});

	test("joins the selected drawing", () => {
		const first = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(first);
		const next = drawStroke(first, id, { ...pen, points: [] });
		assert.equal(next, first, "an empty stroke changes nothing");
		const joined = drawStroke(first, id, pen);
		assert.equal(joined.layers.length, 1);
		assert.equal(top<DrawingLayer>(joined).strokes.length, 2);
	});

	test("a highlighter multiplies, and only joins a layer that does", () => {
		const highlighter: Stroke = { ...pen, color: "#FFD60A", tip: "marker" };
		const ink: Stroke = { ...pen, tip: "ink" };
		const highlight = drawStroke(blank(), null, highlighter);
		const layer = top<DrawingLayer>(highlight);
		assert.equal(layer.blend, "multiply");
		const joined = drawStroke(highlight, layer.id, highlighter);
		assert.equal(joined.layers.length, 1);
		assert.equal(top<DrawingLayer>(joined).strokes.length, 2);
		const penOver = drawStroke(highlight, layer.id, pen);
		assert.equal(penOver.layers.length, 2);
		assert.equal(top<DrawingLayer>(penOver).blend, undefined);
		const markerOver = drawStroke(highlight, layer.id, ink);
		assert.equal(markerOver.layers.length, 2);
		assert.equal(top<DrawingLayer>(markerOver).blend, undefined);

		const plain = drawStroke(blank(), null, pen);
		const plainId = top<DrawingLayer>(plain).id;
		assert.equal(top<DrawingLayer>(plain).blend, undefined);
		const over = drawStroke(plain, plainId, highlighter);
		assert.equal(over.layers.length, 2);
		assert.equal(top<DrawingLayer>(over).blend, "multiply");
		const inkJoined = drawStroke(plain, plainId, ink);
		assert.equal(inkJoined.layers.length, 1);
		assert.equal(top<DrawingLayer>(inkJoined).strokes.length, 2);
	});

	test("starts a new drawing over a locked one", () => {
		const first = drawStroke(blank(), null, pen);
		const locked = {
			...first,
			layers: [{ ...top<DrawingLayer>(first), locked: true }],
		};
		const next = drawStroke(locked, top<DrawingLayer>(first).id, pen);
		assert.equal(next.layers.length, 2);
	});
});

describe("eraseStroke", () => {
	test("joins a multiplying drawing and a plain one", () => {
		const eraser = eraserOf(20, [10, 10, 40, 40]);
		const highlighter: Stroke & { type: "pen" } = {
			...pen,
			color: "#FFD60A",
			tip: "marker",
		};
		for (const stroke of [pen, highlighter]) {
			const first = drawStroke(blank(), null, stroke);
			const erased = eraseStroke(first, eraser, null);
			assert.equal(erased.layers.length, 1);
			assert.equal(top<DrawingLayer>(erased).strokes.length, 2);
			assert.equal(top<DrawingLayer>(erased).strokes[1].type, "eraser");
		}
	});

	test("crosses two drawings from two sessions, with nothing selected", () => {
		const document = twoSessions();
		const [a, b] = document.layers;
		const erased = eraseStroke(document, eraserOf(10, [0, 35, 70, 35]), null);
		assert.equal(erased.layers.length, 2);
		assert.equal(lastStroke(layerOf(erased, a.id))?.type, "eraser");
		assert.equal(lastStroke(layerOf(erased, b.id))?.type, "eraser");
	});

	test("misses a drawing whose box it misses", () => {
		const far = drawStroke(twoSessions(), null, {
			...pen,
			points: [300, 250, 350, 280],
		});
		const farLayer = top<DrawingLayer>(far);
		const erased = eraseStroke(far, eraserOf(10, [0, 35, 70, 35]), null);
		assert.notEqual(erased, far);
		assert.equal(layerOf(erased, farLayer.id), farLayer);
	});

	test("leaves locked and hidden drawings", () => {
		const document = twoSessions();
		const eraser = eraserOf(10, [0, 35, 70, 35]);
		for (const flag of ["locked", "hidden"] as const) {
			const kept = {
				...document,
				layers: document.layers.map((layer) => ({ ...layer, [flag]: true })),
			};
			assert.equal(eraseStroke(kept, eraser, null), kept);
		}
		const [a, b] = document.layers;
		const oneLocked = {
			...document,
			layers: [{ ...a, locked: true }, b],
		};
		const erased = eraseStroke(oneLocked, eraser, null);
		assert.equal(layerOf(erased, a.id), oneLocked.layers[0]);
		assert.equal(lastStroke(layerOf(erased, b.id))?.type, "eraser");
	});

	test("reaches a neon stroke's glow, past its width", () => {
		// A neon line 20 wide glows about 15 from its middle; an eraser 10
		// wide 18 away clears some of the glow but none of a round pen.
		const line = [100, 100, 200, 100];
		const eraser = eraserOf(10, [100, 118, 200, 118]);
		const neon = drawStroke(blank(), null, {
			...pen,
			width: 20,
			tip: "neon",
			points: line,
		});
		const erased = eraseStroke(neon, eraser, null);
		assert.equal(lastStroke(top(erased))?.type, "eraser");
		const round = drawStroke(blank(), null, {
			...pen,
			width: 20,
			points: line,
		});
		assert.equal(eraseStroke(round, eraser, null), round);
	});

	test("removes a drawing it erases away with the shapes it crosses, in one edit", () => {
		const drawn = drawStroke(blank(), null, pen);
		const document = addShape(drawn, "rectangle", place, style);
		const [drawing, shape] = document.layers;
		const erased = eraseStroke(
			document,
			eraserOf(40, [10, 10, 60, 60, 150, 150]),
			null,
		);
		assert.equal(erased.layers.length, 0);
		assert.deepEqual(
			removedLayers(document, erased).map((layer) => layer.id),
			[drawing.id, shape.id],
		);
	});

	test("shrinks a drawing's box once a whole stroke is erased away", () => {
		const first = drawStroke(blank(), null, pen);
		const joined = drawStroke(first, top<DrawingLayer>(first).id, {
			...pen,
			points: [200, 200, 260, 260],
		});
		const before = top<DrawingLayer>(joined);
		const erased = eraseStroke(
			joined,
			eraserOf(40, [200, 200, 260, 260]),
			null,
		);
		const after = top<DrawingLayer>(erased);
		assert.equal(after.strokes.length, 1, "the pen and its eraser both go");
		assert.ok(drawingBox(after).halfWidth < drawingBox(before).halfWidth);
		// What's left draws where it was drawn.
		const start = toDocumentSpace(after.transform, {
			x: after.strokes[0].points[0],
			y: after.strokes[0].points[1],
		});
		assert.deepEqual(start, { x: 10, y: 10 });
	});

	test("never reaches a redaction, a photo, a sticker, or text", () => {
		const canvas = { width: 400, height: 300 };
		const area = { x: 50, y: 50, width: 300, height: 200 };
		const effect = { type: "solid", color: "#000000" } as const;
		const brushed = createRedactionStrokes(
			{ type: "pen", width: 20, points: [100, 100, 300, 100] },
			effect,
		);
		const box = createRedactionBox(
			{ x: 90, y: 80, width: 220, height: 40 },
			effect,
		);
		const photo = createImageLayer(canvas, "photo.jpg", 400, 300, true);
		const sticker = createStickerLayer(
			canvas,
			"sticker.png",
			100,
			100,
			false,
			area,
		);
		const text = createTextLayer(canvas, "Total", {}, area);
		const protectedLayers: Layer[] = [photo, brushed, box, sticker, text];
		const drawn = drawStroke({ ...blank(), layers: protectedLayers }, null, {
			...pen,
			points: [100, 90, 300, 110],
		});
		const eraser = eraserOf(30, [0, 100, 400, 100]);
		const erased = eraseStroke(drawn, eraser, null);
		assert.notEqual(erased, drawn, "the drawing is erased");
		const scoped = eraseStroke(drawn, eraser, brushed.id);
		assert.equal(scoped, drawn);
		for (const result of [erased, scoped]) {
			for (const layer of protectedLayers) {
				assert.equal(layerOf(result, layer.id), layer, layer.type);
			}
		}
	});

	test("with a scope, erases only that drawing and leaves shapes", () => {
		const drawn = twoSessions();
		const document = addShape(drawn, "rectangle", place, style);
		const [a, b, shape] = document.layers;
		const eraser = eraserOf(10, [0, 35, 70, 35, 150, 150]);
		const erased = eraseStroke(document, eraser, a.id);
		assert.equal(lastStroke(layerOf(erased, a.id))?.type, "eraser");
		assert.equal(layerOf(erased, b.id), b);
		assert.equal(layerOf(erased, shape.id), shape);
	});

	test("removes each shape it crosses, whole", () => {
		const document = addShape(blank(), "rectangle", place, style);
		const erased = eraseStroke(
			document,
			eraserOf(20, [150, 120, 150, 180]),
			null,
		);
		assert.equal(erased.layers.length, 0);
	});

	test("leaves locked and hidden shapes, and starts nothing", () => {
		const document = addShape(blank(), "rectangle", place, style);
		const shape = top<ShapeLayer>(document);
		const eraser = eraserOf(20, [150, 120, 150, 180]);
		for (const flag of ["locked", "hidden"] as const) {
			const kept = { ...document, layers: [{ ...shape, [flag]: true }] };
			assert.equal(eraseStroke(kept, eraser, null), kept);
		}
		const missed = eraseStroke(document, { ...eraser, points: [0, 0] }, null);
		assert.equal(missed, document);
		assert.equal(eraseStroke(blank(), eraser, null).layers.length, 0);
	});
});
