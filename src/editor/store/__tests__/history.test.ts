/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
	createBlankDocument,
	createDocumentFromImage,
} from "../../document/document.ts";
import type { DrawingLayer, Stroke } from "../../layers/drawing/drawing.ts";
import type { TextLayer } from "../../layers/text/text.ts";
import {
	createEditorSlice,
	type EditorSlice,
	MAX_HISTORY,
	selectAppDocument,
	selectCanRedo,
	selectCanUndo,
	stepsByMark,
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

function textLayers(store: ReturnType<typeof createTestStore>) {
	return (store.getState().document?.layers ?? []).filter(
		(layer): layer is TextLayer => layer.type === "text",
	);
}

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
	const pen = (points: number[]): Stroke & { type: "pen" } => ({
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
		assert.equal(store.getState().toolSession, null);
		assert.equal(store.getState().past.length, pastLength + 1);

		actions.undo();
		assert.equal(store.getState().document, before);
		assert.equal(store.getState().selectedLayerId, text.id);
	});

	const drawingsIn = (store: ReturnType<typeof createTestStore>) =>
		(store.getState().document?.layers ?? []).filter(
			(layer): layer is DrawingLayer => layer.type === "drawing",
		);

	test("a Pen session keeps one undo step per mark", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.selectLayer(null);
		const steps = store.getState().past.length;
		actions.beginSession(false, "marks");
		actions.drawStroke(pen([0, 0, 10, 0]));
		const a = store.getState().selectedLayerId;
		actions.drawStroke(pen([10, 0, 20, 0]), a);
		actions.drawStroke(pen([20, 0, 30, 0]), a);
		actions.drawStroke(pen([200, 200, 210, 200]));
		const b = store.getState().selectedLayerId;
		actions.drawStroke(pen([210, 200, 220, 200]), b);
		actions.commitSession();
		assert.equal(store.getState().past.length, steps + 2);

		actions.undo();
		assert.deepEqual(
			drawingsIn(store).map((drawing) => drawing.strokes.length),
			[3],
		);
		assert.equal(store.getState().selectedLayerId, null);
		actions.undo();
		assert.equal(drawingsIn(store).length, 0);
		actions.redo();
		assert.equal(drawingsIn(store).length, 1);
		actions.redo();
		assert.deepEqual(
			drawingsIn(store).map((drawing) => drawing.strokes.length),
			[3, 2],
		);
	});

	test("a mark's step follows the layer it changed, not a tap that moved the selection", () => {
		const style = { color: "#FF3B30", strokeWidth: 12 };
		const place = { x: 400, y: 300, rotation: 0, width: 200, height: 100 };
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const steps = store.getState().past.length;
		actions.beginSession(false, "marks");
		actions.addShape("rectangle", place, style);
		const a = store.getState().selectedLayerId ?? "";
		actions.setShapeStyle(a, { color: "#0A84FF" });
		// Deselecting before the next box leaves A's restyle with A.
		actions.selectLayer(null);
		actions.addShape("ellipse", { ...place, x: 100 }, style);
		// Selecting A again and restyling it is a step apart from B.
		actions.selectLayer(a);
		actions.setShapeStyle(a, { strokeWidth: 4 });
		actions.commitSession();
		assert.equal(store.getState().past.length, steps + 3);

		const shapesNow = () =>
			(store.getState().document?.layers ?? []).flatMap((layer) =>
				layer.type === "shape"
					? [[layer.shape, layer.color, layer.strokeWidth]]
					: [],
			);
		actions.undo();
		assert.deepEqual(shapesNow(), [
			["rectangle", "#0A84FF", 12],
			["ellipse", "#FF3B30", 12],
		]);
		actions.undo();
		assert.deepEqual(shapesNow(), [["rectangle", "#0A84FF", 12]]);
		actions.undo();
		assert.deepEqual(shapesNow(), []);
	});

	test("an Eraser session keeps one undo step per swipe", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		for (const x of [0, 200, 400]) {
			actions.drawStroke(pen([x, 0, x, 100]));
		}
		actions.selectLayer(null);
		const steps = store.getState().past.length;
		actions.beginSession(false, "each");
		for (const x of [0, 200, 400]) {
			actions.eraseStroke(
				{ type: "eraser", width: 40, points: [x, 0, x, 100] },
				null,
			);
		}
		assert.equal(drawingsIn(store).length, 0);
		actions.commitSession();
		assert.equal(store.getState().past.length, steps + 3);
		actions.undo();
		assert.equal(drawingsIn(store).length, 1);
	});

	test("undo after a kept session restores the starting selection", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		assert.equal(store.getState().selectedLayerId, text.id);
		actions.beginSession(false, "marks");
		actions.drawStroke(pen([0, 0, 10, 0]));
		actions.drawStroke(pen([200, 0, 210, 0]));
		actions.commitSession();
		actions.undo();
		assert.equal(store.getState().selectedLayerId, text.id);
	});

	test("restyling the mark it opened on joins that mark's step", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.drawStroke(pen([0, 0, 10, 0]));
		const mark = store.getState().selectedLayerId ?? "";
		const steps = store.getState().past.length;
		actions.beginSession(false, "marks");
		actions.restyleDrawing(mark, { color: "#0A84FF" });
		actions.drawStroke({ ...pen([10, 0, 20, 0]), color: "#0A84FF" }, mark);
		actions.commitSession();
		assert.equal(store.getState().past.length, steps + 1);
	});

	test("canceling a kept session still restores its start as one redo step", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const before = store.getState().document;
		actions.beginSession(false, "marks");
		actions.drawStroke(pen([0, 0, 10, 0]));
		actions.drawStroke(pen([200, 0, 210, 0]));
		actions.cancelSession();
		assert.equal(store.getState().document, before);
		actions.redo();
		assert.equal(drawingsIn(store).length, 2);
	});

	test("a kept session that changed nothing leaves the history alone", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const { past } = store.getState();
		actions.beginSession(false, "each");
		actions.commitSession();
		assert.equal(store.getState().past, past);
	});

	test("a kept session longer than the history keeps what fits", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.beginSession(false, "marks");
		for (let i = 0; i < MAX_HISTORY + 5; i++) {
			actions.drawStroke(pen([i * 3, 0, i * 3 + 1, 0]));
		}
		actions.commitSession();
		assert.equal(store.getState().past.length, MAX_HISTORY);
	});

	test("undo and redo stop at the session's start while it's open", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.beginSession(false, "each");
		actions.drawStroke(pen([0, 0, 10, 0]));
		actions.undo();
		assert.equal(selectCanUndo(store.getState()), false);
		actions.redo();
		assert.equal(selectCanRedo(store.getState()), false);
		actions.commitSession();
	});

	test("stepsByMark merges a mark's consecutive steps, and keeps a return to an earlier mark apart", () => {
		// Each a different canvas, so no mark ends as it began.
		let shade = 0;
		const snapshot = (selectedLayerId: string | null) => ({
			document: createBlankDocument(10, 10, `#0000${shade++}0`),
			selectedLayerId,
		});
		// The steps before each change; the mark after each is the next
		// snapshot's selection, and the last's is `current`'s.
		const steps = [snapshot(null), snapshot("a"), snapshot("a"), snapshot("b")];
		assert.deepEqual(stepsByMark(steps, snapshot("b")), [steps[0], steps[2]]);
		const back = [snapshot(null), snapshot("a"), snapshot("b")];
		assert.equal(stepsByMark(back, snapshot("a")).length, 3);
	});

	test("a shape drawn, restyled, and deleted in a kept session leaves no undo step", () => {
		const style = { color: "#FF3B30", strokeWidth: 12 };
		const place = { x: 400, y: 300, rotation: 0, width: 200, height: 100 };
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const { past } = store.getState();
		actions.beginSession(false, "marks");
		actions.addShape("rectangle", place, style);
		const shape = store.getState().selectedLayerId ?? "";
		actions.setShapeStyle(shape, { color: "#0A84FF" });
		actions.deleteLayer(shape);
		actions.commitSession();
		assert.deepEqual(store.getState().past, past);
	});

	test("a mark deleted in a kept session keeps the marks drawn before it", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const steps = store.getState().past.length;
		actions.beginSession(false, "marks");
		actions.drawStroke(pen([0, 0, 10, 0]));
		actions.drawStroke(pen([200, 0, 210, 0]));
		actions.deleteLayer(store.getState().selectedLayerId ?? "");
		actions.commitSession();
		assert.equal(store.getState().past.length, steps + 1);
		actions.undo();
		assert.equal(drawingsIn(store).length, 0);
	});

	test("a mark drawn and deleted between edits to another mark doesn't split it", () => {
		const style = { color: "#FF3B30", strokeWidth: 12 };
		const place = { x: 400, y: 300, rotation: 0, width: 200, height: 100 };
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const { past } = store.getState();
		actions.beginSession(false, "marks");
		actions.addShape("rectangle", place, style);
		const first = store.getState().selectedLayerId ?? "";
		actions.addShape("ellipse", place, style);
		const second = store.getState().selectedLayerId ?? "";
		actions.deleteLayer(second);
		actions.setShapeStyle(first, { color: "#0A84FF" });
		actions.commitSession();
		assert.equal(store.getState().past.length, past.length + 1);
		actions.beginSession(false, "marks");
		actions.addShape("rectangle", place, style);
		const third = store.getState().selectedLayerId ?? "";
		actions.addShape("ellipse", place, style);
		const fourth = store.getState().selectedLayerId ?? "";
		actions.deleteLayer(fourth);
		actions.deleteLayer(third);
		actions.commitSession();
		assert.equal(store.getState().past.length, past.length + 1);
	});

	test("the app sees where a previewing session started, until it's committed", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const before = store.getState().document;
		actions.beginSession(true);
		actions.drawStroke(pen([0, 0, 100, 100]));
		assert.notEqual(store.getState().document, before);
		assert.equal(selectAppDocument(store.getState()), before);
		actions.commitSession();
		assert.equal(
			selectAppDocument(store.getState()),
			store.getState().document,
		);
	});

	test("the app sees a session's changes as they're made, unless it previews", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.beginSession();
		actions.drawStroke(pen([0, 0, 100, 100]));
		assert.equal(
			selectAppDocument(store.getState()),
			store.getState().document,
		);
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
		assert.equal(store.getState().toolSession, null);
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

	test("canceling a previewing session leaves nothing of it to redo", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const { document: before, past } = store.getState();
		actions.beginSession(true);
		actions.drawStroke(pen([0, 0, 100, 100]));
		actions.drawStroke(pen([100, 100, 200, 0]));
		actions.undo();
		actions.cancelSession();
		assert.equal(store.getState().document, before);
		assert.deepEqual(store.getState().past, past);
		assert.equal(selectCanRedo(store.getState()), false);
	});

	test("a previewing session that changed nothing keeps the redo steps from before it", () => {
		const { store, text } = storeWithText();
		const actions = store.getState().actions;
		actions.deleteLayer(text.id);
		actions.undo();
		const { future } = store.getState();
		actions.beginSession(true);
		actions.cancelSession();
		assert.deepEqual(store.getState().future, future);
		actions.redo();
		assert.equal(
			store.getState().document?.layers.some(({ id }) => id === text.id),
			false,
		);
	});

	test("a previewing session that changed nothing keeps the undo steps", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		actions.drawStroke(pen([0, 0, 100, 100]));
		const { document: before, past } = store.getState();
		actions.beginSession(true);
		actions.cancelSession();
		assert.equal(store.getState().document, before);
		assert.deepEqual(store.getState().past, past);
		assert.equal(selectCanUndo(store.getState()), true);
	});

	test("a previewing session undone to its start keeps the undo steps", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const { past } = store.getState();
		actions.beginSession(true);
		actions.drawStroke(pen([0, 0, 100, 100]));
		actions.undo();
		actions.cancelSession();
		assert.deepEqual(store.getState().past, past);
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

	test("opening or closing a document ends a previewing tool session", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const next = photo();
		const another = photo();

		actions.beginSession(true);
		actions.drawStroke(pen([0, 0, 100, 100]));
		actions.closeDocument();
		assert.equal(store.getState().toolSession, null);
		assert.equal(selectAppDocument(store.getState()), null);

		actions.openDocument(next, "project-2");
		actions.beginSession(true);
		actions.drawStroke(pen([0, 0, 40, 40]));
		const previewed = store.getState().toolSession?.document;
		actions.openDocument(another, "project-3");
		assert.equal(store.getState().toolSession, null);
		assert.equal(selectAppDocument(store.getState()), another);
		// The previewing tool cancels as its screen unmounts, after the open.
		actions.cancelSession();
		assert.equal(store.getState().document, another);
		assert.notEqual(store.getState().document, previewed);

		actions.beginSession();
		assert.equal(store.getState().toolSession?.document, another);
		actions.drawStroke(pen([0, 0, 10, 10]));
		actions.commitSession();
		assert.equal(store.getState().past.length, 1);
		assert.equal(store.getState().past[0]?.document, another);
		assert.notEqual(store.getState().past[0]?.document, next);
	});

	test("opening or closing a document ends a tool session that commits", () => {
		const { store } = storeWithText();
		const actions = store.getState().actions;
		const next = photo();

		actions.beginSession();
		actions.drawStroke(pen([0, 0, 100, 100]));
		const previous = store.getState().toolSession?.document;
		actions.closeDocument();
		assert.equal(store.getState().toolSession, null);
		assert.equal(selectAppDocument(store.getState()), null);

		actions.openDocument(next, "project-2");
		assert.equal(store.getState().toolSession, null);
		assert.equal(selectAppDocument(store.getState()), next);
		// The tool commits as its screen unmounts, after the next document is open.
		actions.commitSession();
		assert.deepEqual(store.getState().past, []);
		assert.equal(store.getState().document, next);

		actions.beginSession();
		assert.equal(store.getState().toolSession?.document, next);
		actions.drawStroke(pen([0, 0, 20, 20]));
		actions.commitSession();
		assert.equal(store.getState().past.length, 1);
		assert.equal(store.getState().past[0]?.document, next);
		assert.notEqual(store.getState().past[0]?.document, previous);
	});
});
