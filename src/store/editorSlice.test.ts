/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
	createDocumentFromImage,
	type ImageLayer,
	type TextLayer,
} from "../model/document.ts";
import {
	createEditorSlice,
	MAX_HISTORY,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "./editorSlice.ts";
import type { StoreState } from "./index.ts";

const photo = () => createDocumentFromImage("file:///photo.jpg", 4000, 3000);

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
	store.getState().addTextLayer("TOP TEXT", "center");
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
		store.getState().addTextLayer("BOTTOM", "left");
		store.getState().updateSelectedText({ color: "#FF3B30" });

		const [first, last] = textLayers(store);
		assert.equal(first, text, "unselected layer is untouched");
		assert.equal(last.color, "#FF3B30");
		assert.equal(last.text, "BOTTOM");
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
		store.getState().addTextLayer("BOTTOM", "center");
		const { selectedLayerId } = store.getState();
		store.getState().deleteLayer(text.id);
		assert.equal(textLayers(store).length, 1);
		assert.equal(store.getState().selectedLayerId, selectedLayerId);
	});

	test("moving a layer reorders the stack and keeps the selection", () => {
		const { store, text } = storeWithText();
		store.getState().addTextLayer("BOTTOM", "center");
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
		store.getState().addTextLayer("BOTTOM", "center");
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

	test("the photo can't be moved, nudged, hidden, or deleted", () => {
		const { store } = storeWithText();
		const before = store.getState();
		const photoId = before.document?.layers[0].id ?? "";
		before.moveLayer(photoId, 1);
		before.nudgeLayer(photoId, 1, 0);
		before.setLayerHidden(photoId, true);
		before.deleteLayer(photoId);
		assert.equal(store.getState(), before);
	});

	test("edits without a document are ignored", () => {
		const store = createTestStore();
		const before = store.getState();
		before.addTextLayer("x", "center");
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
		store.getState().addTextLayer("more", "center");
		store.getState().moveLayer(id, 2);
		store.getState().setLayerHidden(id, true);
		store.getState().deleteLayer(id);
		assert.deepEqual(document, snapshot);
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
			store.getState().addTextLayer("BOTTOM", "center");
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
			store.getState().addTextLayer("OTHER", "center");
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

			store.getState().addTextLayer("x", "center");
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
