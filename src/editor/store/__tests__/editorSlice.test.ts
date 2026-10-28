/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { neutralAdjustments } from "../../../model/adjustments.ts";
import {
	createBlankDocument,
	createDocumentFromImage,
} from "../../../model/document.ts";
import { documentFraming } from "../../../model/framing.ts";
import type { DrawingLayer, Stroke } from "../../../model/layers/drawing.ts";
import type { ImageLayer } from "../../../model/layers/image.ts";
import type { RedactionLayer } from "../../../model/layers/redaction.ts";
import type { ShapeLayer } from "../../../model/layers/shape.ts";
import type { TextLayer } from "../../../model/layers/text.ts";
import type { MaskStroke } from "../../../model/strokes.ts";
import {
	createEditorSlice,
	type EditorSlice,
	MAX_HISTORY,
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedShape,
	selectSelectedTextLayer,
} from "../editorSlice.ts";

const photo = () =>
	createDocumentFromImage("file:///photo.jpg", 4000, 3000, true);

function createTestStore() {
	return createStore<EditorSlice>()(
		devtools((...args) => ({ ...createEditorSlice(...args) }), {
			enabled: false,
		}),
	);
}

function storeWithText() {
	const store = createTestStore();
	const actions = store.getState().actions;
	actions.openDocument(photo(), "project-1");
	actions.addTextLayer("TOP TEXT");
	const text = store.getState().document?.layers.at(-1) as TextLayer;
	return { store, text };
}

const firstImage = (store: ReturnType<typeof createTestStore>) =>
	store.getState().document?.layers[0] as ImageLayer;

function textLayers(store: ReturnType<typeof createTestStore>) {
	return (store.getState().document?.layers ?? []).filter(
		(layer): layer is TextLayer => layer.type === "text",
	);
}

describe("editorSlice", () => {
	test("opening a document replaces the previous one and clears selection", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const next = photo();
		actions.openDocument(next, "project-2");
		assert.equal(store.getState().document, next);
		assert.equal(store.getState().key, "project-2");
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("closing clears the document, its key, and selection", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.closeDocument();
		assert.equal(store.getState().document, null);
		assert.equal(store.getState().key, null);
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
		const actions = store.getState().actions;
		actions.addImageLayer("file:///added.jpg", 8000, 6000, true);
		const added = store.getState().document?.layers.at(-1);
		assert.ok(added?.type === "image");
		assert.equal(added.uri, "file:///added.jpg");
		assert.equal(added.locked, false);
		assert.equal(added.transform.scaleX, (4000 * 0.8) / 8000);
		assert.equal(store.getState().selectedLayerId, added.id);

		actions.undo();
		assert.equal(store.getState().document?.layers.length, 2);
		assert.equal(store.getState().selectedLayerId, text.id);
		actions.redo();
		assert.equal(store.getState().document?.layers.at(-1), added);
	});

	test("adding a sticker puts it on top, marked, and selects it", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.addStickerLayer("file:///sticker.png", 512, 512, false);
		const added = store.getState().document?.layers.at(-1);
		assert.ok(added?.type === "image");
		assert.equal(added.sticker, true);
		assert.equal(added.opaque, false);
		assert.equal(store.getState().selectedLayerId, added.id);

		actions.undo();
		assert.equal(store.getState().document?.layers.length, 2);
	});

	test("a blank canvas takes photos, and they move", () => {
		const store = createTestStore();
		const actions = store.getState().actions;
		actions.openDocument(createBlankDocument(1080, 1080, null), "project-1");
		actions.addImageLayer("file:///a.jpg", 400, 300, true);
		actions.addImageLayer("file:///b.jpg", 400, 300, true);
		const [first, second] = store.getState().document?.layers ?? [];
		assert.equal(store.getState().selectedLayerId, second.id);
		actions.nudgeLayer(first.id, 10, 0);
		assert.equal(store.getState().document?.layers[0].transform.x, 550);
	});

	test("selecting a layer updates the selected text layer", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.selectLayer(null);
		assert.equal(store.getState().selectedLayerId, null);
		assert.equal(selectSelectedTextLayer(store.getState()), undefined);

		actions.selectLayer(text.id);
		assert.equal(store.getState().selectedLayerId, text.id);
		assert.equal(selectSelectedTextLayer(store.getState()), text);
	});

	test("duplicating copies the selected text on top and selects the copy", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.duplicateSelectedLayer();
		const [original, copy] = textLayers(store);
		assert.equal(original, text);
		assert.notEqual(copy.id, text.id);
		assert.equal(copy.text, text.text);
		assert.equal(store.getState().selectedLayerId, copy.id);
	});

	test("any layer type can be selected and duplicated", () => {
		const store = createTestStore();
		const actions = store.getState().actions;
		const document = photo();
		const sticker: ImageLayer = {
			...(document.layers[0] as ImageLayer),
			id: "sticker",
			width: 400,
			height: 400,
			locked: false,
		};
		actions.openDocument(
			{ ...document, layers: [...document.layers, sticker] },
			"project-1",
		);

		actions.selectLayer(sticker.id);
		assert.equal(selectSelectedLayer(store.getState()), sticker);
		assert.equal(selectSelectedTextLayer(store.getState()), undefined);

		actions.duplicateSelectedLayer();
		const copy = store.getState().document?.layers.at(-1);
		assert.equal(copy?.type, "image");
		assert.notEqual(copy?.id, sticker.id);
		assert.equal(store.getState().selectedLayerId, copy?.id);
	});

	test("updating text patches only the selected text layer", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM", { align: "left" });
		actions.updateSelectedText({ color: "#FF3B30" });

		const [first, last] = textLayers(store);
		assert.equal(first, text, "unselected layer is untouched");
		assert.equal(last.color, "#FF3B30");
		assert.equal(last.text, "BOTTOM");
	});

	test("new text takes the style it's given", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM", {
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
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM");
		actions.updateTextLayer(text.id, { text: "TOP", font: "serif" });

		const [first, last] = textLayers(store);
		assert.equal(first.text, "TOP");
		assert.equal(first.font, "serif");
		assert.equal(last.text, "BOTTOM");
		assert.equal(store.getState().selectedLayerId, last.id);

		actions.undo();
		assert.equal(textLayers(store)[0], text, "one undo step");
	});

	test("font and background box are edited like the other styles", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.updateSelectedText({ font: "marker" });
		actions.updateSelectedText({ backgroundColor: "#000000" });
		assert.equal(textLayers(store)[0].font, "marker");
		assert.equal(textLayers(store)[0].backgroundColor, "#000000");

		actions.undo();
		actions.undo();
		assert.deepEqual(textLayers(store), [text]);
	});

	test("transforms apply by id, not to whatever is selected now", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.selectLayer(null);
		const transform = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 0.5 };

		actions.transformLayer(text.id, transform);

		assert.deepEqual(textLayers(store)[0].transform, transform);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("enables free resize for text and image layers only", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.setLayerResizable(text.id, true);
		assert.equal(textLayers(store)[0].resizable, true);

		actions.addImageLayer("file:///added.jpg", 400, 300, true);
		const image = store.getState().document?.layers.at(-1);
		assert.equal(image?.type, "image");
		if (image?.type !== "image") return;
		actions.setLayerResizable(image.id, true);
		assert.equal(store.getState().document?.layers.at(-1)?.resizable, true);

		actions.setLayerResizable("missing", true);
		actions.setLayerResizable(text.id, true);
		assert.equal(store.getState().past.length, 4, "no-ops do not add history");
	});

	test("deleting the selected layer removes it and clears selection", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.deleteLayer(text.id);
		const { document, selectedLayerId } = store.getState();
		assert.ok(!document?.layers.some((layer) => layer.id === text.id));
		assert.equal(document?.layers.length, 1, "the photo stays");
		assert.equal(selectedLayerId, null);
	});

	test("deleting another layer keeps the selection", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		actions.deleteLayer(text.id);
		assert.equal(textLayers(store).length, 1);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("moving a layer reorders the stack and keeps the selection", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		actions.moveLayer(text.id, 2);
		assert.equal(textLayers(store).at(-1)?.id, text.id);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("hiding the selected layer clears selection; showing doesn't select", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.setLayerHidden(text.id, true);
		assert.equal(textLayers(store)[0].hidden, true);
		assert.equal(store.getState().selectedLayerId, null);

		actions.setLayerHidden(text.id, false);
		assert.equal(textLayers(store)[0].hidden, false);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("hiding another layer keeps the selection", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.addTextLayer("BOTTOM");
		const { selectedLayerId } = store.getState();
		actions.setLayerHidden(text.id, true);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("nudging moves a layer by a document-space offset", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.nudgeLayer(text.id, 5, -3);
		const { x, y } = textLayers(store)[0].transform;
		assert.equal(x, text.transform.x + 5);
		assert.equal(y, text.transform.y - 3);
	});

	test("a locked photo can't be moved on the canvas", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const before = store.getState();
		const photoId = before.document?.layers[0].id ?? "";
		actions.nudgeLayer(photoId, 1, 0);
		actions.transformLayer(photoId, {
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
		const actions = store.getState().actions;
		const photoId = store.getState().document?.layers[0].id ?? "";
		const ids = () =>
			store.getState().document?.layers.map((layer) => layer.id);

		actions.moveLayer(photoId, 1);
		assert.deepEqual(ids(), [text.id, photoId]);
		actions.setLayerHidden(photoId, true);
		assert.equal(store.getState().document?.layers[1].hidden, true);
		actions.deleteLayer(photoId);
		assert.deepEqual(ids(), [text.id]);
		actions.deleteLayer(text.id);
		assert.deepEqual(ids(), []);

		actions.undo();
		actions.undo();
		assert.deepEqual(ids(), [text.id, photoId]);
	});

	test("an unlocked photo moves; locking it again clears its selection", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const photoId = store.getState().document?.layers[0].id ?? "";
		actions.setLayerLocked(photoId, false);
		actions.selectLayer(photoId);
		actions.nudgeLayer(photoId, 10, 0);
		const moved = store.getState().document?.layers[0];
		assert.equal(moved?.transform.x, 2010);

		actions.setLayerLocked(photoId, true);
		assert.equal(store.getState().document?.layers[0].locked, true);
		assert.equal(store.getState().selectedLayerId, null);
		actions.undo();
		assert.equal(store.getState().selectedLayerId, photoId);
	});

	test("reframing is one undo step, and an unchanged framing isn't one", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const before = store.getState();
		const framing = documentFraming(before.document ?? photo());
		actions.reframe(framing, false);
		assert.equal(store.getState(), before);

		actions.reframe({ ...framing, width: 2000, height: 1000 }, false);
		assert.equal(store.getState().document?.width, 2000);
		assert.equal(store.getState().document?.height, 1000);
		actions.undo();
		assert.equal(store.getState().document, before.document);
	});

	test("the background can be set and undone", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const before = store.getState();
		actions.setBackground(null);
		assert.equal(store.getState(), before);
		actions.setBackground("#FFFFFF");
		assert.equal(store.getState().document?.background, "#FFFFFF");
		actions.undo();
		assert.equal(store.getState().document?.background, null);
	});

	test("edits without a document are ignored", () => {
		const store = createTestStore();
		const actions = store.getState().actions;
		const before = store.getState();
		actions.addTextLayer("x");
		actions.addImageLayer("x", 1, 1, true);
		actions.updateSelectedText({ text: "y" });
		actions.duplicateSelectedLayer();
		actions.moveLayer("x", 1);
		actions.nudgeLayer("x", 1, 0);
		actions.setLayerHidden("x", true);
		actions.deleteLayer("x");
		actions.undo();
		actions.redo();
		assert.equal(store.getState(), before);
	});

	test("never mutates the previous document", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const document = store.getState().document;
		const snapshot = structuredClone(document);
		const id = store.getState().selectedLayerId ?? "";
		actions.updateSelectedText({ text: "changed" });
		actions.addTextLayer("more");
		actions.moveLayer(id, 2);
		actions.setLayerHidden(id, true);
		actions.deleteLayer(id);
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
			const actions = store.getState().actions;
			actions.drawStroke(pen([0, 0, 100, 100]));
			const [drawing] = drawings(store);
			assert.equal(store.getState().document?.layers.at(-1), drawing);
			assert.equal(store.getState().selectedLayerId, drawing.id);

			actions.drawStroke(pen([100, 100, 200, 0]));
			assert.equal(drawings(store).length, 1);
			assert.equal(drawings(store)[0].strokes.length, 2);
		});

		test("a stroke with another layer selected starts a new drawing", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.selectLayer(text.id);
			actions.drawStroke(pen([0, 0, 100, 100]));
			assert.equal(drawings(store).length, 2);
		});

		test("an eraser only erases the selected drawing", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const eraser: Stroke = { type: "eraser", width: 30, points: [0, 0] };
			actions.selectLayer(null);
			const before = store.getState().document;
			actions.drawStroke(eraser);
			assert.equal(store.getState().document, before);

			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.drawStroke(eraser);
			assert.deepEqual(
				drawings(store)[0].strokes.map((stroke) => stroke.type),
				["pen", "eraser"],
			);
		});

		test("each stroke is an undo step, back to no drawing at all", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.selectLayer(null);
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.drawStroke(pen([100, 100, 200, 0]));
			actions.undo();
			assert.equal(drawings(store)[0].strokes.length, 1);
			actions.undo();
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

		function storeWithGroup() {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const found = (x: number) => ({
				width: 60,
				height: 40,
				transform: { x, y: 300, scaleX: 1, scaleY: 1, rotation: 0 },
			});
			actions.addRedactionBoxes([found(200), found(500)], blur);
			const group = store.getState().document?.groups?.[0];
			assert.ok(group);
			return { store, text, group, boxes: redactions(store) };
		}

		test("a box goes on top, centered on what it covers, and is selected", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addRedactionBox(box, black);
			const [redaction] = redactions(store);
			assert.equal(store.getState().document?.layers.at(-1), redaction);
			assert.equal(selectSelectedRedaction(store.getState()), redaction);
			assert.equal(redaction.shape === "box" && redaction.width, 300);
			assert.deepEqual(
				[redaction.transform.x, redaction.transform.y],
				[250, 225],
			);
		});

		test("a selection's redaction goes on top, over the image, and is selected", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const image = firstImage(store);
			actions.addMaskedRedaction(
				image.id,
				"file:///selection.png",
				{ x: 0, y: 0, width: 4000, height: 3000 },
				blur,
			);
			const [redaction] = redactions(store);
			assert.equal(selectSelectedRedaction(store.getState()), redaction);
			assert.equal(redaction.shape, "mask");
			assert.deepEqual(redaction.transform, image.transform);
		});

		test("detected boxes are added unselected and undone together", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.addRedactionBoxes(
				[
					{
						width: 120,
						height: 80,
						transform: {
							x: 200,
							y: 300,
							scaleX: 1,
							scaleY: 1,
							rotation: 0.2,
						},
					},
					{
						width: 60,
						height: 40,
						transform: {
							x: 500,
							y: 600,
							scaleX: 1,
							scaleY: 1,
							rotation: -0.1,
						},
					},
				],
				blur,
			);
			const added = redactions(store);
			assert.equal(added.length, 2);
			const [group] = store.getState().document?.groups ?? [];
			assert.equal(group?.name, "Find results");
			assert.deepEqual(
				group?.layerIds,
				added.map((layer) => layer.id),
			);
			assert.deepEqual(
				added.map(({ effect, transform }) => ({ effect, transform })),
				[
					{
						effect: blur,
						transform: {
							x: 200,
							y: 300,
							scaleX: 1,
							scaleY: 1,
							rotation: 0.2,
						},
					},
					{
						effect: blur,
						transform: {
							x: 500,
							y: 600,
							scaleX: 1,
							scaleY: 1,
							rotation: -0.1,
						},
					},
				],
			);
			assert.equal(store.getState().selectedLayerId, null);
			assert.equal(store.getState().past.length, 2, "one new history step");

			actions.setLayerGroupHidden(group?.id ?? "", true);
			assert.ok(
				added.every((layer) => {
					const current = store
						.getState()
						.document?.layers.find(({ id }) => id === layer.id);
					return current?.hidden;
				}),
			);
			actions.undo();
			assert.equal(store.getState().document?.groups?.length, 1);

			actions.undo();
			assert.equal(store.getState().document, before);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("a group's boxes lock and hide together, clearing a selection among them", () => {
			const { store, text, group, boxes } = storeWithGroup();
			const actions = store.getState().actions;
			actions.selectLayer(text.id);
			actions.setLayerGroupLocked(group.id, true);
			assert.ok(redactions(store).every((layer) => layer.locked));
			assert.equal(store.getState().selectedLayerId, text.id);

			actions.setLayerGroupLocked(group.id, false);
			actions.selectLayer(boxes[1].id);
			actions.setLayerGroupHidden(group.id, true);
			assert.ok(redactions(store).every((layer) => layer.hidden));
			assert.equal(store.getState().selectedLayerId, null);

			actions.undo();
			assert.deepEqual(redactions(store), boxes);
			assert.equal(store.getState().selectedLayerId, boxes[1].id);
			actions.setLayerGroupLocked(group.id, true);
			assert.equal(store.getState().selectedLayerId, null);
		});

		test("a group's flags change nothing when its boxes already have them", () => {
			const { store, group } = storeWithGroup();
			const actions = store.getState().actions;
			const before = store.getState();
			actions.setLayerGroupHidden(group.id, false);
			actions.setLayerGroupLocked(group.id, false);
			actions.setLayerGroupLocked("missing", true);
			actions.deleteLayerGroup("missing");
			assert.equal(store.getState(), before);
		});

		test("deleting a group removes its boxes, and a selection among them", () => {
			const { store, text, group, boxes } = storeWithGroup();
			const actions = store.getState().actions;
			actions.selectLayer(boxes[0].id);
			actions.deleteLayerGroup(group.id);
			assert.deepEqual(redactions(store), []);
			assert.deepEqual(store.getState().document?.groups, []);
			assert.equal(store.getState().selectedLayerId, null);

			actions.undo();
			actions.selectLayer(text.id);
			actions.deleteLayerGroup(group.id);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("resizing a box is one undo step, by id", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.addRedactionBox(box, black);
			const [redaction] = redactions(store);
			actions.selectLayer(text.id);
			const steps = store.getState().past.length;
			const moved = { ...redaction.transform, x: 280 };
			actions.resizeBox(redaction.id, moved, 360, 80);
			const [resized] = redactions(store);
			assert.equal(resized.shape === "box" && resized.width, 360);
			assert.equal(resized.shape === "box" && resized.height, 80);
			assert.deepEqual(resized.transform, moved);
			assert.equal(store.getState().selectedLayerId, text.id);
			assert.equal(store.getState().past.length, steps + 1);

			actions.undo();
			assert.deepEqual(redactions(store), [redaction]);
		});

		test("resizing to the same box, or no box, changes nothing", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addRedactionBox(box, black);
			actions.paintRedaction(mask([0, 0, 100, 0]), black);
			const [boxed, brushed] = redactions(store);
			const before = store.getState().document;
			const resize = actions.resizeBox;
			resize(boxed.id, boxed.transform, 300, 50);
			resize(boxed.id, boxed.transform, 0, 50);
			resize(brushed.id, brushed.transform, 300, 50);
			resize("missing", boxed.transform, 300, 50);
			assert.equal(store.getState().document, before);
		});

		test("an empty box is ignored", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.addRedactionBox({ ...box, height: 0 }, black);
			assert.equal(store.getState().document, before);
		});

		test("restyling is one undo step, and the same style isn't one", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addRedactionBox(box, black);
			const [redaction] = redactions(store);
			const steps = store.getState().past.length;
			actions.setRedactionEffect(redaction.id, { ...black });
			assert.equal(store.getState().past.length, steps);

			actions.setRedactionEffect(redaction.id, blur);
			assert.deepEqual(redactions(store)[0].effect, blur);
			actions.setRedactionEffect(redaction.id, pixels);
			actions.setRedactionEffect(redaction.id, { ...pixels });
			assert.equal(store.getState().past.length, steps + 2);
			actions.undo();
			assert.deepEqual(redactions(store)[0].effect, blur);
			actions.undo();
			assert.deepEqual(redactions(store)[0].effect, black);
		});

		test("brush strokes join the selected brushed redaction", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.paintRedaction(mask([0, 0, 100, 0]), blur);
			actions.paintRedaction(mask([0, 50, 100, 50]), black);
			actions.paintRedaction(mask([50, 0], "eraser"), black);
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
			const actions = store.getState().actions;
			actions.addRedactionBox(box, black);
			const before = store.getState().document;
			actions.paintRedaction(mask([0, 0], "eraser"), black);
			assert.equal(store.getState().document, before);

			actions.paintRedaction(mask([0, 0, 100, 0]), black);
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
			const actions = store.getState().actions;
			const steps = store.getState().past.length;
			actions.addShape("ellipse", place, style);
			const [shape] = shapes(store);
			assert.equal(store.getState().document?.layers.at(-1), shape);
			assert.equal(selectSelectedShape(store.getState()), shape);
			assert.equal(shape.shape, "ellipse");
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("a box needs both sides, and a line only its length", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.addShape("rectangle", { ...place, height: 0 }, style);
			actions.addShape("arrow", { ...place, width: 0 }, style);
			assert.equal(store.getState().document, before);
			actions.addShape("arrow", { ...place, height: 0 }, style);
			assert.equal(shapes(store).length, 1);
		});

		test("restyling is one undo step, and the same style isn't one", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addShape("rectangle", place, style);
			const [shape] = shapes(store);
			const steps = store.getState().past.length;
			actions.setShapeStyle(shape.id, { ...style });
			actions.setShapeStyle(shape.id, { shape: "line" });
			assert.equal(store.getState().past.length, steps);

			actions.setShapeStyle(shape.id, { color: "#FFFFFF" });
			assert.equal(shapes(store)[0].color, "#FFFFFF");
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("an eraser removes each shape it passes over, as one undo step", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addShape("rectangle", place, style);
			actions.addShape("arrow", { ...place, y: 900 }, style);
			const [box, arrow] = shapes(store);
			const steps = store.getState().past.length;
			// Across the rectangle's top edge, at y = 250, and nowhere near the arrow.
			const eraser: Stroke = {
				type: "eraser",
				width: 20,
				points: [400, 200, 400, 300],
			};
			actions.drawStroke(eraser);
			assert.deepEqual(shapes(store), [arrow]);
			assert.equal(store.getState().past.length, steps + 1);
			// The arrow was selected, and still is.
			assert.equal(store.getState().selectedLayerId, arrow.id);

			actions.undo();
			assert.deepEqual(shapes(store), [box, arrow]);
		});

		test("erasing the selected shape clears the selection", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addShape("line", place, style);
			actions.drawStroke({
				type: "eraser",
				width: 20,
				points: [400, 300],
			});
			assert.deepEqual(shapes(store), []);
			assert.equal(store.getState().selectedLayerId, null);
		});

		test("an eraser leaves locked and hidden shapes, and misses nothing else", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addShape("line", place, style);
			actions.addShape("line", place, style);
			const [locked, hidden] = shapes(store);
			actions.setLayerLocked(locked.id, true);
			actions.setLayerHidden(hidden.id, true);
			const before = store.getState().document;
			actions.drawStroke({
				type: "eraser",
				width: 20,
				points: [400, 300],
			});
			assert.equal(store.getState().document, before);
		});

		test("an eraser erases in the selected drawing and removes shapes together", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.addShape("line", place, style);
			actions.drawStroke({
				type: "pen",
				color: "#000000",
				width: 10,
				points: [0, 0, 100, 100],
			});
			const steps = store.getState().past.length;
			actions.drawStroke({
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
			const actions = store.getState().actions;
			actions.addShape("arrow", place, style);
			const [line] = shapes(store);
			const turned = { ...line.transform, rotation: 1 };
			actions.resizeBox(line.id, turned, 320, 60);
			const [resized] = shapes(store);
			assert.equal(resized.shape === "arrow" && resized.length, 320);
			assert.deepEqual(resized.transform, turned);
		});
	});

	describe("history", () => {
		test("undoing an add removes the text and restores the selection", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.undo();
			assert.equal(textLayers(store).length, 0);
			assert.equal(store.getState().selectedLayerId, null);

			actions.redo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a delete brings the layer back selected", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.deleteLayer(text.id);
			actions.undo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a hide shows the layer selected again", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.setLayerHidden(text.id, true);
			actions.undo();
			assert.deepEqual(textLayers(store), [text]);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("undoing a move restores the order", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.addTextLayer("BOTTOM");
			const before = store.getState().document;
			actions.moveLayer(text.id, 2);
			actions.undo();
			assert.equal(store.getState().document, before);
		});

		test("a run of nudges to one layer is a single undo step", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			const { past } = store.getState();
			for (let i = 0; i < 5; i++) actions.nudgeLayer(text.id, 1, 0);
			assert.equal(store.getState().past.length, past.length + 1);
			assert.equal(textLayers(store)[0].transform.x, text.transform.x + 5);

			actions.undo();
			assert.equal(store.getState().document, before);
		});

		test("any other change ends a run of nudges", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.addTextLayer("OTHER");
			const other = textLayers(store)[1];
			const { past } = store.getState();

			actions.nudgeLayer(text.id, 1, 0);
			actions.nudgeLayer(other.id, 1, 0);
			actions.updateSelectedText({ color: "#FF3B30" });
			actions.nudgeLayer(other.id, 1, 0);
			actions.undo();
			actions.nudgeLayer(other.id, 1, 0);
			assert.equal(store.getState().past.length, past.length + 4);
		});

		test("a nudge that joins a run still clears the redo stack", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.nudgeLayer(text.id, 1, 0);
			actions.updateSelectedText({ color: "#FF3B30" });
			actions.undo();
			actions.nudgeLayer(text.id, 1, 0);
			assert.deepEqual(store.getState().future, []);
		});

		test("undo restores the exact earlier document", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.updateSelectedText({ color: "#FF3B30" });
			actions.transformLayer(text.id, { ...text.transform, x: 1, rotation: 1 });
			const after = store.getState().document;

			actions.undo();
			actions.undo();
			assert.equal(store.getState().document, before);

			actions.redo();
			actions.redo();
			assert.equal(store.getState().document, after);
		});

		test("a new edit after undo clears the redo stack", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.updateSelectedText({ color: "#FF3B30" });
			actions.undo();
			actions.updateSelectedText({ color: "#34C759" });
			assert.deepEqual(store.getState().future, []);
		});

		test("selecting and no-op edits aren't recorded", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const { past } = store.getState();
			actions.selectLayer(null);
			actions.selectLayer(text.id);
			actions.updateSelectedText({ text: text.text, align: text.align });
			actions.moveLayer(text.id, 1);
			actions.nudgeLayer(text.id, 0, 0);
			actions.setLayerHidden(text.id, false);
			actions.deleteLayer("missing");
			assert.equal(store.getState().past, past);
		});

		test("no-op transforms preserve history and redo", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			actions.updateSelectedText({ color: "#FF3B30" });
			actions.undo();
			const before = store.getState();

			actions.transformLayer(text.id, text.transform);
			assert.equal(store.getState(), before);

			actions.transformLayer("missing", { ...text.transform, x: 1 });
			assert.equal(store.getState(), before);
		});

		test("only the most recent steps can be undone", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const documents = [store.getState().document];
			for (let x = 1; x <= MAX_HISTORY + 5; x++) {
				actions.transformLayer(text.id, { ...text.transform, x });
				documents.push(store.getState().document);
			}
			assert.equal(store.getState().past.length, MAX_HISTORY);

			while (store.getState().past.length > 0) actions.undo();
			assert.equal(store.getState().document, documents.at(-1 - MAX_HISTORY));

			while (store.getState().future.length > 0) actions.redo();
			assert.equal(store.getState().document, documents.at(-1));
			assert.equal(store.getState().past.length, MAX_HISTORY);
		});

		test("opening or closing a document clears history", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.duplicateSelectedLayer();
			actions.undo();
			actions.openDocument(photo(), "project-1");
			assert.deepEqual(store.getState().past, []);
			assert.deepEqual(store.getState().future, []);

			actions.addTextLayer("x");
			actions.closeDocument();
			assert.deepEqual(store.getState().past, []);
		});

		test("undo and redo with nothing to step to change nothing", () => {
			const store = createTestStore();
			const actions = store.getState().actions;
			actions.openDocument(photo(), "project-1");
			const before = store.getState();
			actions.undo();
			actions.redo();
			assert.equal(store.getState(), before);
		});
	});
	describe("sessions", () => {
		const pen = (points: number[]): Stroke => ({
			type: "pen",
			color: "#FF3B30",
			width: 10,
			points,
		});

		test("committing makes a session's changes one undo step", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			const pastLength = store.getState().past.length;
			actions.beginSession();
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.drawStroke(pen([100, 100, 200, 0]));
			actions.commitSession();
			assert.equal(store.getState().session, null);
			assert.equal(store.getState().past.length, pastLength + 1);

			actions.undo();
			assert.equal(store.getState().document, before);
			assert.equal(store.getState().selectedLayerId, text.id);
		});

		test("canceling restores where the session started", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const { document: before, past } = store.getState();
			actions.beginSession();
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.deleteLayer(text.id);
			actions.cancelSession();
			assert.equal(store.getState().document, before);
			assert.equal(store.getState().selectedLayerId, text.id);
			assert.deepEqual(store.getState().past, past);
			assert.equal(store.getState().session, null);
		});

		test("redo brings a canceled session back as one step", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.beginSession();
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.deleteLayer(text.id);
			const { document: canceled, selectedLayerId } = store.getState();
			actions.cancelSession();
			assert.equal(selectCanRedo(store.getState()), true);

			actions.redo();
			assert.equal(store.getState().document, canceled);
			assert.equal(store.getState().selectedLayerId, selectedLayerId);
			actions.undo();
			assert.equal(store.getState().document, before);
		});

		test("a canceled session keeps the steps undone within it", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.beginSession();
			actions.drawStroke(pen([0, 0, 100, 100]));
			const oneStroke = store.getState().document;
			actions.drawStroke(pen([100, 100, 200, 0]));
			const twoStrokes = store.getState().document;
			actions.undo();
			actions.cancelSession();

			actions.redo();
			assert.equal(store.getState().document, oneStroke);
			actions.redo();
			assert.equal(store.getState().document, twoStrokes);
		});

		test("a session without changes leaves the history alone", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const { document, past } = store.getState();
			actions.beginSession();
			actions.commitSession();
			assert.equal(store.getState().document, document);
			assert.equal(store.getState().past, past);
		});

		test("undo stops at the session's start", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.beginSession();
			assert.equal(selectCanUndo(store.getState()), false);
			actions.undo();
			assert.equal(textLayers(store).length, 1);

			actions.drawStroke(pen([0, 0, 100, 100]));
			assert.equal(selectCanUndo(store.getState()), true);
			actions.undo();
			actions.undo();
			assert.equal(textLayers(store).length, 1);
		});

		test("redo stops at the session's start, as undo does", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.undo();
			const before = store.getState().document;
			actions.beginSession();
			assert.equal(selectCanRedo(store.getState()), false);
			actions.redo();
			assert.equal(store.getState().document, before);

			actions.drawStroke(pen([100, 100, 200, 0]));
			actions.undo();
			assert.equal(selectCanRedo(store.getState()), true);
			actions.redo();
			assert.notEqual(store.getState().document, before);
		});

		test("a session without changes leaves the redo steps from before it", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.drawStroke(pen([0, 0, 100, 100]));
			const drawn = store.getState().document;
			actions.undo();
			actions.beginSession();
			actions.commitSession();
			assert.equal(selectCanRedo(store.getState()), true);
			actions.redo();
			assert.equal(store.getState().document, drawn);
		});

		test("undoing within a session, then drawing again, still commits one step", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			const pastLength = store.getState().past.length;
			actions.beginSession();
			actions.drawStroke(pen([0, 0, 100, 100]));
			actions.undo();
			actions.drawStroke(pen([100, 100, 200, 0]));
			actions.commitSession();
			assert.equal(store.getState().past.length, pastLength + 1);
			actions.undo();
			assert.equal(store.getState().document, before);
		});

		test("a session longer than the history keeps only its own step", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.beginSession();
			for (let i = 0; i <= MAX_HISTORY; i++) {
				actions.drawStroke(pen([i, 0, i + 10, 10]));
			}
			actions.commitSession();
			assert.equal(store.getState().past.length, 1);
			actions.undo();
			assert.equal(store.getState().document, before);
		});
	});

	describe("adjustments", () => {
		const warm = { ...neutralAdjustments, temperature: 0.5 };
		test("adjusting is one undo step, and undo takes it back", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const steps = store.getState().past.length;
			actions.setAdjustments("photo", warm);
			assert.deepEqual(firstImage(store).adjustments, warm);
			assert.equal(store.getState().past.length, steps + 1);
			actions.undo();
			assert.equal(firstImage(store).adjustments, undefined);
		});

		test("the same adjustments aren't a step, and none leaves them out", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.setAdjustments("photo", warm);
			const steps = store.getState().past.length;
			actions.setAdjustments("photo", { ...warm });
			assert.equal(store.getState().past.length, steps);
			actions.setAdjustments("photo", neutralAdjustments);
			assert.equal("adjustments" in firstImage(store), false);
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("only images take adjustments", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.setAdjustments(text.id, warm);
			actions.setAdjustments("missing", warm);
			assert.equal(store.getState().document, before);
		});
	});

	describe("setMask", () => {
		test("cutting out is one undo step, and undo brings the background back", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			const steps = store.getState().past.length;
			actions.setMask("photo", "file:///mask.png");
			assert.equal(firstImage(store).mask, "file:///mask.png");
			assert.equal(store.getState().past.length, steps + 1);
			actions.undo();
			assert.equal("mask" in firstImage(store), false);
		});

		test("the same mask isn't a step, and null takes it off", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.setMask("photo", "file:///mask.png");
			const steps = store.getState().past.length;
			actions.setMask("photo", "file:///mask.png");
			assert.equal(store.getState().past.length, steps);
			actions.setMask("photo", null);
			assert.equal("mask" in firstImage(store), false);
			assert.equal(store.getState().past.length, steps + 1);
		});

		test("only images take a mask", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.setMask(text.id, "file:///mask.png");
			actions.setMask("missing", "file:///mask.png");
			assert.equal(store.getState().document, before);
		});
	});

	describe("invertMask", () => {
		test("inverting a cut is one undo step", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.setMask("photo", "file:///mask.png");
			const steps = store.getState().past.length;
			actions.invertMask("photo", "file:///inverse.png");
			assert.equal(firstImage(store).mask, "file:///inverse.png");
			assert.equal(store.getState().past.length, steps + 1);
			actions.undo();
			assert.equal(firstImage(store).mask, "file:///mask.png");
		});

		test("an image that isn't cut has nothing to invert", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.invertMask("photo", "file:///inverse.png");
			actions.invertMask(text.id, "file:///inverse.png");
			assert.equal(store.getState().document, before);
		});
	});

	describe("paintMask", () => {
		const eraser: MaskStroke = { type: "eraser", width: 20, points: [10, 10] };
		const pen: MaskStroke = { type: "pen", width: 20, points: [10, 10] };

		test("erasing cuts a whole image by hand, a step at a time", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const steps = store.getState().past.length;
			actions.paintMask("photo", eraser);
			actions.paintMask("photo", pen);
			assert.equal(firstImage(store).maskStrokes?.length, 2);
			assert.equal(store.getState().past.length, steps + 2);
			assert.equal(store.getState().selectedLayerId, text.id, "kept");
			actions.undo();
			actions.undo();
			assert.equal("maskStrokes" in firstImage(store), false);
		});

		test("keeping what's whole already isn't a step", () => {
			const { store, text } = storeWithText();
			const actions = store.getState().actions;
			const before = store.getState().document;
			actions.paintMask("photo", pen);
			actions.paintMask(text.id, eraser);
			actions.paintMask("missing", eraser);
			assert.equal(store.getState().document, before);
		});

		test("a new mask takes the strokes off", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.setMask("photo", "file:///mask.png");
			actions.paintMask("photo", pen);
			actions.setMask("photo", "file:///other.png");
			assert.equal("maskStrokes" in firstImage(store), false);
		});

		test("a mask grown from the old one can keep them", () => {
			const { store } = storeWithText();
			const actions = store.getState().actions;
			actions.setMask("photo", "file:///mask.png");
			actions.paintMask("photo", pen);
			const steps = store.getState().past.length;
			actions.setMask("photo", "file:///grown.png", {
				keepStrokes: true,
			});
			assert.equal(firstImage(store).mask, "file:///grown.png");
			assert.equal(firstImage(store).maskStrokes?.length, 1);
			assert.equal(store.getState().past.length, steps + 1);
		});
	});
});
