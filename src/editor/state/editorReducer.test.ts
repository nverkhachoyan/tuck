/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	createTextLayer,
	type EditorDocument,
	type TextLayer,
} from "../../model/document.ts";
import {
	type EditorState,
	editorReducer,
	initialEditorState,
} from "./editorReducer.ts";

const photo = () => createDocumentFromImage("file:///photo.jpg", 4000, 3000);

function stateWithText(): { state: EditorState; text: TextLayer } {
	const document = photo();
	const text = createTextLayer(document, "TOP TEXT", "center");
	const state = editorReducer(
		{ document, selectedLayerId: null },
		{ type: "text-layer-added", layer: text },
	);
	return { state, text };
}

function textLayers(document: EditorDocument | null) {
	return (document?.layers ?? []).filter(
		(layer): layer is TextLayer => layer.type === "text",
	);
}

describe("editorReducer", () => {
	test("opening a document replaces the previous one and clears selection", () => {
		const { state } = stateWithText();
		const next = photo();
		const opened = editorReducer(state, {
			type: "document-opened",
			document: next,
		});
		assert.equal(opened.document, next);
		assert.equal(opened.selectedLayerId, null);
	});

	test("closing returns to the initial state", () => {
		const { state } = stateWithText();
		assert.equal(
			editorReducer(state, { type: "document-closed" }),
			initialEditorState,
		);
	});

	test("adding text puts it on top and selects it", () => {
		const { state, text } = stateWithText();
		assert.equal(state.document?.layers.at(-1), text);
		assert.equal(state.selectedLayerId, text.id);
	});

	test("updating text patches only the selected text layer", () => {
		const { state, text } = stateWithText();
		const second = createTextLayer(photo(), "BOTTOM", "left");
		const withTwo = editorReducer(state, {
			type: "text-layer-added",
			layer: second,
		});

		const updated = editorReducer(withTwo, {
			type: "selected-text-updated",
			patch: { color: "#FF3B30" },
		});

		const [first, last] = textLayers(updated.document);
		assert.equal(first, text, "unselected layer is untouched");
		assert.equal(last.color, "#FF3B30");
		assert.equal(last.text, "BOTTOM");
	});

	test("transforms apply by id, not to whatever is selected now", () => {
		const { state, text } = stateWithText();
		const deselected = editorReducer(state, {
			type: "layer-selected",
			id: null,
		});
		const transform = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 0.5 };

		const moved = editorReducer(deselected, {
			type: "layer-transformed",
			id: text.id,
			transform,
		});

		assert.deepEqual(textLayers(moved.document)[0].transform, transform);
		assert.equal(moved.selectedLayerId, null);
	});

	test("deleting removes the selected layer and clears selection", () => {
		const { state, text } = stateWithText();
		const deleted = editorReducer(state, { type: "selected-layer-deleted" });
		assert.ok(!deleted.document?.layers.some((layer) => layer.id === text.id));
		assert.equal(deleted.document?.layers.length, 1, "the photo stays");
		assert.equal(deleted.selectedLayerId, null);
	});

	test("edits without a document are ignored", () => {
		const layer = createTextLayer(photo(), "x", "center");
		for (const action of [
			{ type: "text-layer-added", layer },
			{ type: "selected-text-updated", patch: { text: "y" } },
			{ type: "selected-layer-deleted" },
		] as const) {
			assert.equal(
				editorReducer(initialEditorState, action),
				initialEditorState,
			);
		}
	});

	test("never mutates the previous state", () => {
		const { state } = stateWithText();
		const snapshot = structuredClone(state);
		editorReducer(state, {
			type: "selected-text-updated",
			patch: { text: "changed" },
		});
		editorReducer(state, { type: "selected-layer-deleted" });
		assert.deepEqual(state, snapshot);
	});
});
