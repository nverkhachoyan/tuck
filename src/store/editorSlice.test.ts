/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createDocumentFromImage, type TextLayer } from "../model/document.ts";
import { createEditorSlice, selectSelectedTextLayer } from "./editorSlice.ts";
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
	store.getState().openDocument(photo());
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
		store.getState().openDocument(next);
		assert.equal(store.getState().document, next);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("closing clears the document and selection", () => {
		const { store } = storeWithText();
		store.getState().closeDocument();
		assert.equal(store.getState().document, null);
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
		store.getState().duplicateSelectedText();
		const [original, copy] = textLayers(store);
		assert.equal(original, text);
		assert.notEqual(copy.id, text.id);
		assert.equal(copy.text, text.text);
		assert.equal(store.getState().selectedLayerId, copy.id);
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

	test("transforms apply by id, not to whatever is selected now", () => {
		const { store, text } = storeWithText();
		store.getState().selectLayer(null);
		const transform = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 0.5 };

		store.getState().transformLayer(text.id, transform);

		assert.deepEqual(textLayers(store)[0].transform, transform);
		assert.equal(store.getState().selectedLayerId, null);
	});

	test("deleting removes the selected layer and clears selection", () => {
		const { store, text } = storeWithText();
		store.getState().deleteSelectedLayer();
		const { document, selectedLayerId } = store.getState();
		assert.ok(!document?.layers.some((layer) => layer.id === text.id));
		assert.equal(document?.layers.length, 1, "the photo stays");
		assert.equal(selectedLayerId, null);
	});

	test("edits without a document are ignored", () => {
		const store = createTestStore();
		const before = store.getState();
		before.addTextLayer("x", "center");
		before.updateSelectedText({ text: "y" });
		before.duplicateSelectedText();
		before.deleteSelectedLayer();
		assert.equal(store.getState(), before);
	});

	test("never mutates the previous document", () => {
		const { store } = storeWithText();
		const document = store.getState().document;
		const snapshot = structuredClone(document);
		store.getState().updateSelectedText({ text: "changed" });
		store.getState().deleteSelectedLayer();
		assert.deepEqual(document, snapshot);
	});
});
