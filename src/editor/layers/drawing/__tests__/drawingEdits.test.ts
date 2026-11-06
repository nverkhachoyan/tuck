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
import {
	drawingPieces,
	drawStroke,
	eraseStroke,
	eraseWholeStrokes,
	removedLayers,
	restyleDrawing,
	separateDrawing,
} from "../drawingEdits.ts";

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

	test("starts a new drawing for no mark, a locked one, a missing one, or another blend", () => {
		const first = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(first);
		assert.equal(drawStroke(first, null, pen).layers.length, 2);
		assert.equal(drawStroke(first, "missing", pen).layers.length, 2);
		const locked = {
			...first,
			layers: first.layers.map((layer) => ({ ...layer, locked: true })),
		};
		assert.equal(drawStroke(locked, id, pen).layers.length, 2);
		assert.equal(
			drawStroke(first, id, { ...pen, tip: "marker" }).layers.length,
			2,
		);
	});

	test("joins the drawing it's given", () => {
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

describe("eraseWholeStrokes", () => {
	// One drawing of two strokes: a stroke down from (10, 10), and another
	// across at y 200.
	const twoStrokes = () => {
		const first = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(first);
		return drawStroke(first, id, { ...pen, points: [100, 200, 300, 200] });
	};
	const pens = (layer: Layer | undefined) =>
		(layer as DrawingLayer).strokes.filter((stroke) => stroke.type === "pen");

	test("takes each stroke it touches whole, and leaves the rest", () => {
		const document = twoStrokes();
		const erased = eraseWholeStrokes(document, [200, 190, 200, 210], 4, null);
		const left = pens(top(erased));
		assert.equal(left.length, 1);
		assert.deepEqual(
			toDocumentSpace(top<DrawingLayer>(erased).transform, {
				x: left[0].points[0],
				y: left[0].points[1],
			}),
			{ x: 10, y: 10 },
		);
		assert.equal(
			eraseWholeStrokes(document, [200, 100, 200, 120], 4, null),
			document,
			"nothing touched",
		);
	});

	test("touches only remaining ink, and drops erasers left over nothing", () => {
		const document = eraseStroke(
			twoStrokes(),
			eraserOf(30, [200, 180, 200, 220]),
			null,
		);
		assert.equal(top<DrawingLayer>(document).strokes.at(-1)?.type, "eraser");
		assert.equal(
			eraseWholeStrokes(document, [200, 195, 200, 205], 1, null),
			document,
			"the ink there is erased",
		);
		const erased = eraseWholeStrokes(document, [120, 190, 120, 210], 4, null);
		assert.deepEqual(
			top<DrawingLayer>(erased).strokes.map((stroke) => stroke.type),
			["pen"],
		);
	});

	test("removes a drawing it empties, with the shapes it crosses", () => {
		const drawn = twoSessions();
		const document = addShape(drawn, "rectangle", place, style);
		const [a, b, shape] = document.layers;
		// Through the first stroke's start only, then around everything to
		// the rectangle's right side.
		const erased = eraseWholeStrokes(
			document,
			[5, 5, 12, 12, 0, 0, 400, -40, 400, 150, 240, 150],
			4,
			null,
		);
		assert.deepEqual(
			removedLayers(document, erased).map((layer) => layer.id),
			[a.id, shape.id],
		);
		assert.equal(layerOf(erased, b.id), b);
	});

	test("with a scope, touches only that drawing and no shape", () => {
		const drawn = twoSessions();
		const document = addShape(drawn, "rectangle", place, style);
		const [a, b, shape] = document.layers;
		const path = [35, 20, 35, 50, 150, 120, 150, 180];
		const erased = eraseWholeStrokes(document, path, 4, b.id);
		assert.equal(layerOf(erased, a.id), a);
		assert.equal(layerOf(erased, b.id), undefined);
		assert.equal(layerOf(erased, shape.id), shape);
	});

	test("takes only what `removes` allows", () => {
		const document = twoStrokes();
		const path = [200, 190, 200, 210];
		assert.equal(
			eraseWholeStrokes(document, path, 4, null, () => false),
			document,
		);
	});

	test("leaves locked and hidden drawings", () => {
		const document = twoSessions();
		const [a, b] = document.layers;
		const kept = {
			...document,
			layers: [
				{ ...a, locked: true },
				{ ...b, hidden: true },
			],
		};
		assert.equal(eraseWholeStrokes(kept, [0, 35, 70, 35], 4, null), kept);
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
		const document = { ...blank(), layers: protectedLayers };
		const path = [0, 100, 400, 100];
		assert.equal(eraseWholeStrokes(document, path, 20, null), document);
		assert.equal(eraseWholeStrokes(document, path, 20, brushed.id), document);
	});
});

describe("restyleDrawing", () => {
	const twoPensAndAnEraser = () => {
		const first = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(first);
		const joined = drawStroke(first, id, {
			...pen,
			color: "#00ff00",
			points: [100, 100, 160, 100],
		});
		return eraseStroke(joined, eraserOf(10, [130, 90, 130, 110]), null);
	};

	test("recolors every pen stroke and no eraser", () => {
		const document = twoPensAndAnEraser();
		const { id } = top<DrawingLayer>(document);
		const after = top<DrawingLayer>(
			restyleDrawing(document, id, { color: "#0000ff" }),
		);
		assert.deepEqual(
			after.strokes.map((stroke) =>
				stroke.type === "pen" ? stroke.color : "eraser",
			),
			["#0000ff", "#0000ff", "eraser"],
		);
		assert.deepEqual(
			after.strokes[2],
			top<DrawingLayer>(document).strokes[2],
			"the eraser stays",
		);
	});

	test("a highlighter tip multiplies, and back to the pen it doesn't", () => {
		const document = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(document);
		const highlight = restyleDrawing(document, id, { tip: "marker" });
		const marked = top<DrawingLayer>(highlight);
		assert.equal(marked.blend, "multiply");
		const [first] = marked.strokes;
		assert.equal(first.type === "pen" && first.tip, "marker");
		const back = top<DrawingLayer>(
			restyleDrawing(highlight, id, { tip: null }),
		);
		assert.equal(back.blend, undefined);
		assert.equal("tip" in back.strokes[0], false);
	});

	test("a width is in document units, divided by the drawing's scale", () => {
		const drawn = drawStroke(blank(), null, pen);
		const scaled = {
			...drawn,
			layers: drawn.layers.map((layer) => ({
				...layer,
				transform: { ...layer.transform, scaleX: 2, scaleY: 2 },
			})),
		};
		const { id } = top<DrawingLayer>(scaled);
		const after = top<DrawingLayer>(restyleDrawing(scaled, id, { width: 20 }));
		assert.equal(after.strokes[0].width, 10);
		assert.ok(
			drawingBox(after).halfHeight >= 5,
			"it recenters around the wider ink",
		);
	});

	test("a locked drawing, a missing one, and an unchanged patch change nothing", () => {
		const document = drawStroke(blank(), null, pen);
		const { id } = top<DrawingLayer>(document);
		assert.equal(restyleDrawing(document, id, { color: pen.color }), document);
		assert.equal(
			restyleDrawing(document, "missing", { color: "#000000" }),
			document,
		);
		const locked = {
			...document,
			layers: document.layers.map((layer) => ({ ...layer, locked: true })),
		};
		assert.equal(restyleDrawing(locked, id, { color: "#000000" }), locked);
	});
});

describe("drawingPieces and separateDrawing", () => {
	// One drawing holding `strokes` in document space, as drawn in a row.
	const drawingOf = (...strokes: Stroke[]) => {
		const [first, ...rest] = strokes;
		let document = drawStroke(blank(), null, first as Stroke & { type: "pen" });
		const { id } = top<DrawingLayer>(document);
		for (const stroke of rest) {
			document =
				stroke.type === "pen"
					? drawStroke(document, id, stroke)
					: eraseStroke(document, stroke, id);
		}
		return document;
	};
	const across = { ...pen, points: [50, 100, 150, 100] };
	const down = { ...pen, points: [100, 50, 100, 150] };
	const farAway = { ...pen, points: [300, 250, 350, 250] };

	test("crossing strokes, and a chain of touching ones, are one piece; apart they're two", () => {
		assert.deepEqual(drawingPieces(top(drawingOf(across, down))), [[0, 1]]);
		const chain = drawingOf(
			{ ...pen, points: [0, 0, 50, 0] },
			{ ...pen, points: [50, 0, 100, 0] },
			{ ...pen, points: [100, 0, 150, 0] },
		);
		assert.equal(drawingPieces(top(chain)).length, 1);
		assert.deepEqual(drawingPieces(top(drawingOf(across, farAway))), [
			[0],
			[1],
		]);
	});

	test("strokes that touched only where an eraser cleared are two pieces", () => {
		const crossed = drawingOf(across, down, eraserOf(60, [100, 100]));
		assert.equal(drawingPieces(top(crossed)).length, 2);
	});

	test("a stroke erased through its middle stays one piece", () => {
		const cut = drawingOf(across, eraserOf(20, [100, 80, 100, 120]));
		assert.equal(drawingPieces(top(cut)).length, 1);
	});

	test("separating keeps the stack, the first id, the transform and blend, and draws the same", () => {
		const under = drawStroke(blank(), null, {
			...pen,
			points: [0, 280, 20, 280],
		});
		const document = (() => {
			let next = drawStroke(under, null, across);
			const { id } = top<DrawingLayer>(next);
			next = drawStroke(next, id, farAway);
			next = eraseStroke(next, eraserOf(10, [60, 90, 60, 110]), id);
			return drawStroke(next, null, { ...pen, points: [0, 0, 10, 10] });
		})();
		const original = document.layers[1] as DrawingLayer;
		const split = separateDrawing(document, original.id);
		assert.equal(split.layers.length, 4);
		assert.equal(split.layers[0], document.layers[0]);
		assert.equal(split.layers[3], document.layers[2]);
		const [first, second] = split.layers.slice(1, 3) as DrawingLayer[];
		assert.equal(first.id, original.id);
		assert.notEqual(second.id, original.id);
		assert.deepEqual(
			first.strokes.map((stroke) => stroke.type),
			["pen", "eraser"],
			"the eraser goes with the piece it's over",
		);
		assert.deepEqual(
			second.strokes.map((stroke) => stroke.type),
			["pen"],
		);
		const inDocument = (layer: DrawingLayer, index: number) =>
			toDocumentSpace(layer.transform, {
				x: layer.strokes[index].points[0],
				y: layer.strokes[index].points[1],
			});
		assert.deepEqual(inDocument(first, 0), inDocument(original, 0));
		assert.deepEqual(inDocument(second, 0), inDocument(original, 1));
	});

	test("a drawing in one piece, or a locked one, stays as it is", () => {
		const one = drawingOf(across, down);
		assert.equal(separateDrawing(one, top<DrawingLayer>(one).id), one);
		const two = drawingOf(across, farAway);
		const locked = {
			...two,
			layers: two.layers.map((layer) => ({ ...layer, locked: true })),
		};
		assert.equal(separateDrawing(locked, top<DrawingLayer>(locked).id), locked);
	});
});
