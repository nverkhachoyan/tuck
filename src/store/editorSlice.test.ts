/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
	createBlankDocument,
	createDocumentFromImage,
	type DrawingLayer,
	type ImageLayer,
	type MaskStroke,
	type RedactionLayer,
	type ShapeLayer,
	type Stroke,
	type TextLayer,
} from "../model/document.ts";
import { documentFraming } from "../model/framing.ts";
import {
	createEditorSlice,
	MAX_HISTORY,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedShape,
	selectSelectedTextLayer,
} from "./editorSlice.ts";
import type { StoreState } from "./index.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

function createTestStore() {
	return createStore<StoreState>()(
		devtools((...args) => ({ ...createEditorSlice(...args) }), {
			enabled: false,
		}),
	);
}

function storeWithText() {
	const store = createTestStore();
	store.getState().openDocument(photo(), "project-1");
	store.getState().addTextLayer("TOP TEXT");
	const text = store.getState().document?.layers.at(-1) as TextLayer;
	return { store, text };
}

function textLayers(store: ReturnType<typeof createTestStore>) {
	return (store.getState().document?.layers ?? []).filter(
		(layer): layer is TextLayer => layer.type === "text",
	);
}

describe("editorSlice", () => {
	test("opening a document replaces the previous one and clears selection", () => {
		const { store } = storeWithText();
		const next = photo();
		store.getState().openDocument(next, "project-2");
		assert.equal(store.getState().document, next);
		assert.equal(store.getState().projectId, "project-2");
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("closing clears the document, its project, and selection", () => {
		const { store } = storeWithText();
		store.getState().closeDocument();
		assert.equal(store.getState().document, null);
		assert.equal(store.getState().projectId, null);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("adding text puts it on top and selects it", () => {
		const { store, text } = storeWithText();
		assert.equal(text.type, "text");
		assert.equal(text.text, "TOP TEXT");
		assert.equal(store.getState().selectedLayerId, text.id);
		assert.equal(selectSelectedTextLayer(store.getState()), text);
	});

	test("adding a photo puts it on top, fitted and unlocked, and selects it", () => {
		const { store, text } = storeWithText();
		store.getState().addImageLayer("file:///added.jpg", 8000, 6000, true);
		const added = store.getState().document?.layers.at(-1);
		assert.ok(added?.type === "image");
		assert.equal(added.uri, "file:///added.jpg");
		assert.equal(added.locked, false);
		assert.equal(added.transform.scaleX, (4000 * 0.8) / 8000);
		assert.equal(store.getState().selectedLayerId, added.id);

		store.getState().undo();
		assert.equal(store.getState().document?.layers.length, 2);
		assert.equal(store.getState().selectedLayerId, text.id);
		store.getState().redo();
		assert.equal(store.getState().document?.layers.at(-1), added);
	});

	test("adding a sticker puts it on top, marked, and selects it", () => {
		const { store } = storeWithText();
		store.getState().addStickerLayer("file:///sticker.png", 512, 512);
		const added = store.getState().document?.layers.at(-1);
		assert.ok(added?.type === "image");
		assert.equal(added.sticker, true);
		assert.equal(added.opaque, false);
		assert.equal(store.getState().selectedLayerId, added.id);

		store.getState().undo();
		assert.equal(store.getState().document?.layers.length, 2);
	});

	test("a blank canvas takes photos, and they move", () => {
		const store = createTestStore();
		store
			.getState()
			.openDocument(createBlankDocument(1080, 1080, null), "project-1");
		store.getState().addImageLayer("file:///a.jpg", 400, 300, true);
		store.getState().addImageLayer("file:///b.jpg", 400, 300, true);
		const [first, second] = store.getState().document?.layers ?? [];
		assert.equal(store.getState().selectedLayerId, second.id);
		store.getState().nudgeLayer(first.id, 10, 0);
		assert.equal(store.getState().document?.layers[0].transform.x, 550);
	});

	test("selecting a layer updates the selected text layer", () => {
		const { store, text } = storeWithText();
		store.getState().selectLayer(null);
		assert.equal(store.getState().selectedLayerId, null);
		assert.equal(selectSelectedTextLayer(store.getState()), undefined);

		store.getState().selectLayer(text.id);
		assert.equal(store.getState().selectedLayerId, text.id);
		assert.equal(selectSelectedTextLayer(store.getState()), text);
	});

	test("duplicating copies the selected text on top and selects the copy", () => {
		const { store, text } = storeWithText();
		store.getState().duplicateSelectedLayer();
		const [original, copy] = textLayers(store);
		assert.equal(original, text);
		assert.notEqual(copy.id, text.id);
		assert.equal(copy.text, text.text);
		assert.equal(store.getState().selectedLayerId, copy.id);
	});

	test("any layer type can be selected and duplicated", () => {
		const store = createTestStore();
		const document = photo();
		const sticker: ImageLayer = {
			...(document.layers[0] as ImageLayer),
			id: "sticker",
			width: 400,
			height: 400,
			locked: false,
		};
		store
			.getState()
			.openDocument(
				{ ...document, layers: [...document.layers, sticker] },
				"project-1",
			);

		store.getState().selectLayer(sticker.id);
		assert.equal(selectSelectedLayer(store.getState()), sticker);
		assert.equal(selectSelectedTextLayer(store.getState()), undefined);

		store.getState().duplicateSelectedLayer();
		const copy = store.getState().document?.layers.at(-1);
		assert.equal(copy?.type, "image");
		assert.notEqual(copy?.id, sticker.id);
		assert.equal(store.getState().selectedLayerId, copy?.id);
	});

	test("updating text patches only the selected text layer", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM", { align: "left" });
		store.getState().updateSelectedText({ color: "#FF3B30" });

		const [first, last] = textLayers(store);
		assert.equal(first, text, "unselected layer is untouched");
		assert.equal(last.color, "#FF3B30");
		assert.equal(last.text, "BOTTOM");
	});

	test("new text takes the style it's given", () => {
		const { store } = storeWithText();
		store.getState().addTextLayer("BOTTOM", {
			font: "serif",
			outlineColor: null,
		});
		const last = textLayers(store).at(-1);
		assert.equal(last?.font, "serif");
		assert.equal(last?.outlineColor, null);
		assert.equal(last?.color, "#FFFFFF");
	});

	test("text updates by id, whatever is selected now", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM");
		store.getState().updateTextLayer(text.id, { text: "TOP", font: "serif" });

		const [first, last] = textLayers(store);
		assert.equal(first.text, "TOP");
		assert.equal(first.font, "serif");
		assert.equal(last.text, "BOTTOM");
		assert.equal(store.getState().selectedLayerId, last.id);

		store.getState().undo();
		assert.equal(textLayers(store)[0], text, "one undo step");
	});

	test("font and background box are edited like the other styles", () => {
		const { store, text } = storeWithText();
		store.getState().updateSelectedText({ font: "marker" });
		store.getState().updateSelectedText({ backgroundColor: "#000000" });
		assert.equal(textLayers(store)[0].font, "marker");
		assert.equal(textLayers(store)[0].backgroundColor, "#000000");

		store.getState().undo();
		store.getState().undo();
		assert.deepEqual(textLayers(store), [text]);
	});

	test("transforms apply by id, not to whatever is selected now", () => {
		const { store, text } = storeWithText();
		store.getState().selectLayer(null);
		const transform = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 0.5 };

		store.getState().transformLayer(text.id, transform);

		assert.deepEqual(textLayers(store)[0].transform, transform);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("enables free resize for text and image layers only", () => {
		const { store, text } = storeWithText();
		store.getState().setLayerResizable(text.id, true);
		assert.equal(textLayers(store)[0].resizable, true);

		store.getState().addImageLayer("file:///added.jpg", 400, 300, true);
		const image = store.getState().document?.layers.at(-1);
		assert.equal(image?.type, "image");
		if (image?.type !== "image") return;
		store.getState().setLayerResizable(image.id, true);
		assert.equal(store.getState().document?.layers.at(-1)?.resizable, true);

		store.getState().setLayerResizable("missing", true);
		store.getState().setLayerResizable(text.id, true);
		assert.equal(store.getState().past.length, 4, "no-ops do not add history");
	});

	test("deleting the selected layer removes it and clears selection", () => {
		const { store, text } = storeWithText();
		store.getState().deleteLayer(text.id);
		const { document, selectedLayerId } = store.getState();
		assert.ok(!document?.layers.some((layer) => layer.id === text.id));
		assert.equal(document?.layers.length, 1, "the photo stays");
		assert.equal(selectedLayerId, null);
	});

	test("deleting another layer keeps the selection", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		store.getState().deleteLayer(text.id);
		assert.equal(textLayers(store).length, 1);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("moving a layer reorders the stack and keeps the selection", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		store.getState().moveLayer(text.id, 2);
		assert.equal(textLayers(store).at(-1)?.id, text.id);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("hiding the selected layer clears selection; showing doesn't select", () => {
		const { store, text } = storeWithText();
		store.getState().setLayerHidden(text.id, true);
		assert.equal(textLayers(store)[0].hidden, true);
		assert.equal(store.getState().selectedLayerId, null);

		store.getState().setLayerHidden(text.id, false);
		assert.equal(textLayers(store)[0].hidden, false);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("hiding another layer keeps the selection", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		store.getState().setLayerHidden(text.id, true);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("nudging moves a layer by a document-space offset", () => {
		const { store, text } = storeWithText();
		store.getState().nudgeLayer(text.id, 5, -3);
		const { x, y } = textLayers(store)[0].transform;
		assert.equal(x, text.transform.x + 5);
		assert.equal(y, text.transform.y - 3);
	});

	test("a locked photo can't be moved on the canvas", () => {
		const { store } = storeWithText();
		const before = store.getState();
		const photoId = before.document?.layers[0].id ?? "";
		before.nudgeLayer(photoId, 1, 0);
		before.transformLayer(photoId, {
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
		assert.equal(store.getState(), before);
	});

	test("the photo reorders, hides, and deletes like any layer", () => {
		const { store, text } = storeWithText();
		const photoId = store.getState().document?.layers[0].id ?? "";
		const ids = () =>
			store.getState().document?.layers.map((layer) => layer.id);

		store.getState().moveLayer(photoId, 1);
		assert.deepEqual(ids(), [text.id, photoId]);
		store.getState().setLayerHidden(photoId, true);
		assert.equal(store.getState().document?.layers[1].hidden, true);
		store.getState().deleteLayer(photoId);
		assert.deepEqual(ids(), [text.id]);
		store.getState().deleteLayer(text.id);
		assert.deepEqual(ids(), []);

		store.getState().undo();
		store.getState().undo();
		assert.deepEqual(ids(), [text.id, photoId]);
	});

	test("an unlocked photo moves; locking it again clears its selection", () => {
		const { store } = storeWithText();
		const photoId = store.getState().document?.layers[0].id ?? "";
		store.getState().setLayerLocked(photoId, false);
		store.getState().selectLayer(photoId);
		store.getState().nudgeLayer(photoId, 10, 0);
		const moved = store.getState().document?.layers[0];
		assert.equal(moved?.transform.x, 2010);

		store.getState().setLayerLocked(photoId, true);
		assert.equal(store.getState().document?.layers[0].locked, true);
		assert.equal(store.getState().selectedLayerId, null);
		store.getState().undo();
		assert.equal(store.getState().selectedLayerId, photoId);
	});

	test("reframing is one undo step, and an unchanged framing isn't one", () => {
		const { store } = storeWithText();
		const before = store.getState();
		const framing = documentFraming(before.document ?? photo());
		before.reframe(framing, false);
		assert.equal(store.getState(), before);

		before.reframe({ ...framing, width: 2000, height: 1000 }, false);
		assert.equal(store.getState().document?.width, 2000);
		assert.equal(store.getState().document?.height, 1000);
		store.getState().undo();
		assert.equal(store.getState().document, before.document);
	});

	test("the background can be set and undone", () => {
		const { store } = storeWithText();
		const before = store.getState();
		before.setBackground(null);
		assert.equal(store.getState(), before);
		before.setBackground("#FFFFFF");
		assert.equal(store.getState().document?.background, "#FFFFFF");
		store.getState().undo();
		assert.equal(store.getState().document?.background, null);
	});

	test("edits without a document are ignored", () => {
		const store = createTestStore();
		const before = store.getState();
		before.addTextLayer("x");
		before.addImageLayer("x", 1, 1, true);
		before.updateSelectedText({ text: "y" });
		before.duplicateSelectedLayer();
		before.moveLayer("x", 1);
		before.nudgeLayer("x", 1, 0);
		before.setLayerHidden("x", true);
		before.deleteLayer("x");
		before.undo();
		before.redo();
		assert.equal(store.getState(), before);
	});

	test("never mutates the previous document", () => {
		const { store } = storeWithText();
		const document = store.getState().document;
		const snapshot = structuredClone(document);
		const id = store.getState().selectedLayerId ?? "";
		store.getState().updateSelectedText({ text: "changed" });
		store.getState().addTextLayer("more");
		store.getState().moveLayer(id, 2);
		store.getState().setLayerHidden(id, true);
		store.getState().deleteLayer(id);
		assert.deepEqual(document, snapshot);
	});

	describe("drawing", () => {
		const pen = (points: number[]): Stroke => ({
			type: "pen",
			color: "#FF3B30",
			width: 10,
			points,
		});

		function drawings(store: ReturnType<typeof createTestStore>) {
			return (store.getState().document?.layers ?? []).filter(
				(layer): layer is DrawingLayer => layer.type === "drawing",
			);
		}

		test("a stroke starts a selected drawing on top, and the next joins it", () => {
			const { store } = storeWithText();
			store.getState().drawStroke(pen([0, 0, 100, 100]));
			const [drawing] = drawings(store);
			assert.equal(store.getState().document?.layers.at(-1), drawing);
			assert.equal(store.getState().selectedLayerId, drawing.id);

			store.getState().drawStroke(pen([100, 100, 200, 0]));
			assert.equal(drawings(store).length, 1);
			assert.equal(drawings(store)[0].strokes.length, 2);
		});

		test("a stroke with another layer selected starts a new drawing", () => {
			const { store, text } = storeWithText();
			store.getState().drawStroke(pen([0, 0, 100, 100]));
			store.getState().selectLayer(text.id);
			store.getState().drawStroke(pen([0, 0, 100, 100]));
			assert.equal(drawings(store).length, 2);
		});

		test("an eraser only erases the selected drawing", () => {
			const { store } = storeWithText();
			const eraser: Stroke = { type: "eraser", width: 30, points: [0, 0] };
			store.getState().selectLayer(null);
			const before = store.getState().document;
			store.getState().drawStroke(eraser);
			assert.equal(store.getState().document, before);

			store.getState().drawStroke(pen([0, 0, 100, 100]));
			store.getState().drawStroke(eraser);
			assert.deepEqual(
				drawings(store)[0].strokes.map((stroke) => stroke.type),
				["pen", "eraser"],
			);
		});

		test("each stroke is an undo step, back to no drawing at all", () => {
			const { store } = storeWithText();
			store.getState().selectLayer(null);
			store.getState().drawStroke(pen([0, 0, 100, 100]));
			store.getState().drawStroke(pen([100, 100, 200, 0]));
			store.getState().undo();
			assert.equal(drawings(store)[0].strokes.length, 1);
			store.getState().undo();
			assert.equal(drawings(store).length, 0);
			assert.equal(store.getState().selectedLayerId, null);
		});
	});

	describe("redaction", () => {
		const black = { type: "solid", color: "#000000" } as const;
		const blur = { type: "blur", radius: 24 } as const;
		const pixels = { type: "pixelate", size: 16 } as const;
		const box = { x: 100, y: 200, width: 300, height: 50 };
		const mask = (
			points: number[],
			type: MaskStroke["type"] = "pen",
		): MaskStroke => ({ type, width: 40, points });

		function redactions(store: ReturnType<typeof createTestStore>) {
			return (store.getState().document?.layers ?? []).filter(
				(layer): layer is RedactionLayer => layer.type === "redaction",
			);
		}

		test("a box goes on top, centered on what it covers, and is selected", () => {
			const { store } = storeWithText();
			store.getState().addRedactionBox(box, black);
			const [redaction] = redactions(store);
			assert.equal(store.getState().document?.layers.at(-1), redaction);
			assert.equal(selectSelectedRedaction(store.getState()), redaction);
			assert.equal(redaction.shape === "box" && redaction.width, 300);
			assert.deepEqual(
				[redaction.transform.x, redaction.transform.y],
				[250, 225],
			);
		});

		test("resizing a box is one undo step, by id", () => {
			const { store, text } = storeWithText();
			store.getState().addRedactionBox(box, black);
			const [redaction] = redactions(store);
			store.getState().selectLayer(text.id);
			const steps = store.getState().past.length;
			const moved = { ...redaction.transform, x: 280 };
			store.getState().resizeBox(redaction.id, moved, 360, 80);
			const [resized] = redactions(store);
			assert.equal(resized.shape === "box" && resized.width, 360);
			assert.equal(resized.shape === "box" && resized.height, 80);
			assert.deepEqual(resized.transform, moved);
			assert.equal(store.getState().selectedLayerId, text.id);
			assert.equal(store.getState().past.length, steps + 1);

			store.getState().undo();
			assert.deepEqual(redactions(store), [redaction]);
		});

		test("resizing to the same box, or no box, changes nothing", () => {
			const { store } = storeWithText();
			store.getState().addRedactionBox(box, black);
			store.getState().paintRedaction(mask([0, 0, 100, 0]), black);
			const [boxed, brushed] = redactions(store);
			const before = store.getState().document;
			const resize = store.getState().resizeBox;
			resize(boxed.id, boxed.transform, 300, 50);
			resize(boxed.id, boxed.transform, 0, 50);
			resize(brushed.id, brushed.transform, 300, 50);
			resize("missing", boxed.transform, 300, 50);
			assert.equal(store.getState().document, before);
		});

		test("an empty box is ignored", () => {
			const { store } = storeWithText();
			const before = store.getState().document;
			store.getState().addRedactionBox({ ...box, height: 0 }, black);
			assert.equal(store.getState().document, before);
		});

		test("restyling is one undo step, and the same style isn't one", () => {
			const { store } = storeWithText();
			store.getState().addRedactionBox(box, black);
			const [redaction] = redactions(store);
			const steps = store.getState().past.length;
			store.getState().setRedactionEffect(redaction.id, { ...black });
			assert.equal(store.getState().past.length, steps);

			store.getState().setRedactionEffect(redaction.id, blur);
			assert.deepEqual(redactions(store)[0].effect, blur);
			store.getState().setRedactionEffect(redaction.id, pixels);
			store.getState().setRedactionEffect(redaction.id, { ...pixels });
			assert.equal(store.getState().past.length, steps + 2);
			store.getState().undo();
			assert.deepEqual(redactions(store)[0].effect, blur);
			store.getState().undo();
			assert.deepEqual(redactions(store)[0].effect, black);
		});

		test("brush strokes join the selected brushed redaction", () => {
			const { store } = storeWithText();
			store.getState().paintRedaction(mask([0, 0, 100, 0]), blur);
			store.getState().paintRedaction(mask([0, 50, 100, 50]), black);
			store.getState().paintRedaction(mask([50, 0], "eraser"), black);
			const [redaction] = redactions(store);
			assert.equal(redactions(store).length, 1);
			assert.deepEqual(redaction.effect, blur, "keeps its own style");
			assert.deepEqual(
				redaction.shape === "strokes" &&
					redaction.strokes.map((stroke) => stroke.type),
				["pen", "pen", "eraser"],
			);
		});

		test("a brush over a selected box starts a new redaction; an eraser doesn't", () => {
			const { store } = storeWithText();
			store.getState().addRedactionBox(box, black);
			const before = store.getState().document;
			store.getState().paintRedaction(mask([0, 0], "eraser"), black);
			assert.equal(store.getState().document, before);

			store.getState().paintRedaction(mask([0, 0, 100, 0]), black);
			assert.deepEqual(
				redactions(store).map((layer) => layer.shape),
				["box", "strokes"],
			);
		});
	});

	describe("shapes", () => {
		const style = { color: "#FF3B30", strokeWidth: 12 };
		const place = { x: 400, y: 300, rotation: 0, width: 200, height: 100 };

		function shapes(store: ReturnType<typeof createTestStore>) {
			return (store.getState().document?.layers ?? []).filter(
				(layer): layer is ShapeLayer => layer.type === "shape",
			);
		}

		test("a shape goes on top, selected, as one undo step", () => {
			const { store } = storeWithText();
			const steps = store.getState().past.length;
			store.getState().addShape("ellipse", place, style);
			const [shape] = shapes(store);
			assert.equal(store.getState().document?.layers.at(-1), shape);
			assert.equal(selectSelectedShape(store.getState()), shape);
			assert.equal(shape.shape, "ellipse");
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("a box needs both sides, and a line only its length", () => {
			const { store } = storeWithText();
			const before = store.getState().document;
			store.getState().addShape("rectangle", { ...place, height: 0 }, style);
			store.getState().addShape("arrow", { ...place, width: 0 }, style);
			assert.equal(store.getState().document, before);
			store.getState().addShape("arrow", { ...place, height: 0 }, style);
			assert.equal(shapes(store).length, 1);
		});

		test("restyling is one undo step, and the same style isn't one", () => {
			const { store } = storeWithText();
			store.getState().addShape("rectangle", place, style);
			const [shape] = shapes(store);
			const steps = store.getState().past.length;
			store.getState().setShapeStyle(shape.id, { ...style });
			store.getState().setShapeStyle(shape.id, { shape: "line" });
			assert.equal(store.getState().past.length, steps);

			store.getState().setShapeStyle(shape.id, { color: "#FFFFFF" });
			assert.equal(shapes(store)[0].color, "#FFFFFF");
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("an eraser removes each shape it passes over, as one undo step", () => {
			const { store } = storeWithText();
			store.getState().addShape("rectangle", place, style);
			store.getState().addShape("arrow", { ...place, y: 900 }, style);
			const [box, arrow] = shapes(store);
			const steps = store.getState().past.length;
			// Across the rectangle's top edge, at y = 250, and nowhere near the arrow.
			const eraser: Stroke = {
				type: "eraser",
				width: 20,
				points: [400, 200, 400, 300],
			};
			store.getState().drawStroke(eraser);
			assert.deepEqual(shapes(store), [arrow]);
			assert.equal(store.getState().past.length, steps + 1);
			// The arrow was selected, and still is.
			assert.equal(store.getState().selectedLayerId, arrow.id);

			store.getState().undo();
			assert.deepEqual(shapes(store), [box, arrow]);
		});

		test("erasing the selected shape clears the selection", () => {
			const { store } = storeWithText();
			store.getState().addShape("line", place, style);
			store.getState().drawStroke({
				type: "eraser",
				width: 20,
				points: [400, 300],
			});
			assert.deepEqual(shapes(store), []);
			assert.equal(store.getState().selectedLayerId, null);
		});

		test("an eraser leaves locked and hidden shapes, and misses nothing else", () => {
			const { store } = storeWithText();
			store.getState().addShape("line", place, style);
			store.getState().addShape("line", place, style);
			const [locked, hidden] = shapes(store);
			store.getState().setLayerLocked(locked.id, true);
			store.getState().setLayerHidden(hidden.id, true);
			const before = store.getState().document;
			store.getState().drawStroke({
				type: "eraser",
				width: 20,
				points: [400, 300],
			});
			assert.equal(store.getState().document, before);
		});

		test("an eraser erases in the selected drawing and removes shapes together", () => {
			const { store } = storeWithText();
			store.getState().addShape("line", place, style);
			store.getState().drawStroke({
				type: "pen",
				color: "#000000",
				width: 10,
				points: [0, 0, 100, 100],
			});
			const steps = store.getState().past.length;
			store.getState().drawStroke({
				type: "eraser",
				width: 20,
				points: [50, 50, 400, 300],
			});
			assert.deepEqual(shapes(store), []);
			const drawing = store
				.getState()
				.document?.layers.find((layer) => layer.type === "drawing");
			assert.equal(
				drawing?.type === "drawing" && drawing.strokes.at(-1)?.type,
				"eraser",
			);
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("resizing a line sets its length and angle", () => {
			const { store } = storeWithText();
			store.getState().addShape("arrow", place, style);
			const [line] = shapes(store);
			const turned = { ...line.transform, rotation: 1 };
			store.getState().resizeBox(line.id, turned, 320, 60);
			const [resized] = shapes(store);
			assert.equal(resized.shape === "arrow" && resized.length, 320);
			assert.deepEqual(resized.transform, turned);
		});
	});

	describe("history", () => {
		test("undoing an add removes the text and restores the selection", () => {
			const { store, text } = storeWithText();
			store.getState().undo();
			assert.equal(textLayers(store).length, 0);
			assert.equal(store.getState().selectedLayerId, null);

			store.getState().redo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a delete brings the layer back selected", () => {
			const { store, text } = storeWithText();
			store.getState().deleteLayer(text.id);
			store.getState().undo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a hide shows the layer selected again", () => {
			const { store, text } = storeWithText();
			store.getState().setLayerHidden(text.id, true);
			store.getState().undo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a move restores the order", () => {
			const { store, text } = storeWithText();
			store.getState().addTextLayer("BOTTOM");
			const before = store.getState().document;
			store.getState().moveLayer(text.id, 2);
			store.getState().undo();
			assert.equal(store.getState().document, before);
		});

		test("a run of nudges to one layer is a single undo step", () => {
			const { store, text } = storeWithText();
			const before = store.getState().document;
			const { past } = store.getState();
			for (let i = 0; i < 5; i++) store.getState().nudgeLayer(text.id, 1, 0);
			assert.equal(store.getState().past.length, past.length + 1);
			assert.equal(textLayers(store)[0].transform.x, text.transform.x + 5);

			store.getState().undo();
			assert.equal(store.getState().document, before);
		});

		test("any other change ends a run of nudges", () => {
			const { store, text } = storeWithText();
			store.getState().addTextLayer("OTHER");
			const other = textLayers(store)[1];
			const { past } = store.getState();

			store.getState().nudgeLayer(text.id, 1, 0);
			store.getState().nudgeLayer(other.id, 1, 0);
			store.getState().updateSelectedText({ color: "#FF3B30" });
			store.getState().nudgeLayer(other.id, 1, 0);
			store.getState().undo();
			store.getState().nudgeLayer(other.id, 1, 0);
			assert.equal(store.getState().past.length, past.length + 4);
		});

		test("a nudge that joins a run still clears the redo stack", () => {
			const { store, text } = storeWithText();
			store.getState().nudgeLayer(text.id, 1, 0);
			store.getState().updateSelectedText({ color: "#FF3B30" });
			store.getState().undo();
			store.getState().nudgeLayer(text.id, 1, 0);
			assert.deepEqual(store.getState().future, []);
		});

		test("undo restores the exact earlier document", () => {
			const { store, text } = storeWithText();
			const before = store.getState().document;
			store.getState().updateSelectedText({ color: "#FF3B30" });
			store
				.getState()
				.transformLayer(text.id, { ...text.transform, x: 1, rotation: 1 });
			const after = store.getState().document;

			store.getState().undo();
			store.getState().undo();
			assert.equal(store.getState().document, before);

			store.getState().redo();
			store.getState().redo();
			assert.equal(store.getState().document, after);
		});

		test("a new edit after undo clears the redo stack", () => {
			const { store } = storeWithText();
			store.getState().updateSelectedText({ color: "#FF3B30" });
			store.getState().undo();
			store.getState().updateSelectedText({ color: "#34C759" });
			assert.deepEqual(store.getState().future, []);
		});

		test("selecting and no-op edits aren't recorded", () => {
			const { store, text } = storeWithText();
			const { past } = store.getState();
			store.getState().selectLayer(null);
			store.getState().selectLayer(text.id);
			store
				.getState()
				.updateSelectedText({ text: text.text, align: text.align });
			store.getState().moveLayer(text.id, 1);
			store.getState().nudgeLayer(text.id, 0, 0);
			store.getState().setLayerHidden(text.id, false);
			store.getState().deleteLayer("missing");
			assert.equal(store.getState().past, past);
		});

		test("no-op transforms preserve history and redo", () => {
			const { store, text } = storeWithText();
			store.getState().updateSelectedText({ color: "#FF3B30" });
			store.getState().undo();
			const before = store.getState();

			before.transformLayer(text.id, text.transform);
			assert.equal(store.getState(), before);

			before.transformLayer("missing", { ...text.transform, x: 1 });
			assert.equal(store.getState(), before);
		});

		test("only the most recent steps can be undone", () => {
			const { store, text } = storeWithText();
			const documents = [store.getState().document];
			for (let x = 1; x <= MAX_HISTORY + 5; x++) {
				store.getState().transformLayer(text.id, { ...text.transform, x });
				documents.push(store.getState().document);
			}
			assert.equal(store.getState().past.length, MAX_HISTORY);

			while (store.getState().past.length > 0) store.getState().undo();
			assert.equal(store.getState().document, documents.at(-1 - MAX_HISTORY));

			while (store.getState().future.length > 0) store.getState().redo();
			assert.equal(store.getState().document, documents.at(-1));
			assert.equal(store.getState().past.length, MAX_HISTORY);
		});

		test("opening or closing a document clears history", () => {
			const { store } = storeWithText();
			store.getState().duplicateSelectedLayer();
			store.getState().undo();
			store.getState().openDocument(photo(), "project-1");
			assert.deepEqual(store.getState().past, []);
			assert.deepEqual(store.getState().future, []);

			store.getState().addTextLayer("x");
			store.getState().closeDocument();
			assert.deepEqual(store.getState().past, []);
		});

		test("undo and redo with nothing to step to change nothing", () => {
			const store = createTestStore();
			store.getState().openDocument(photo(), "project-1");
			const before = store.getState();
			before.undo();
			before.redo();
			assert.equal(store.getState(), before);
		});
	});
});
