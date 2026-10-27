/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTextLayer } from "../../../model/layers/text.ts";
import {
	type EditorModeAction,
	type EditorModeState,
	type Eyedropper,
	editorModeReducer,
	initialEditorMode,
	type ModeTargets,
	openTray,
	settle,
	shortcutCommand,
	type TextEditState,
	takesKeys,
	toolImageId,
} from "../editorMode.ts";
import type { Shortcut } from "../shortcuts.ts";

type State = EditorModeState;

const run = (state: State, ...actions: EditorModeAction[]) =>
	actions.reduce(
		(current: State, action) => editorModeReducer(current, action),
		state,
	);

const edit = (id: string): TextEditState => ({
	layer: { ...createTextLayer({ width: 100, height: 100 }, ""), id },
	isNew: false,
	selection: { start: 0, end: 0 },
	initialSelection: { start: 0, end: 0 },
	focused: false,
});
const eyedropper = (): Eyedropper => ({ apply: () => {} });
const targets = (overrides: Partial<ModeTargets> = {}): ModeTargets => ({
	isAdjustable: () => true,
	canFind: true,
	selectedTextId: null,
	...overrides,
});

const drawing = run(initialEditorMode, {
	type: "startTool",
	start: { tool: "draw" },
});

describe("editorModeReducer", () => {
	test("starting a tool closes the layers sheet and a text color picker", () => {
		const state = run(
			initialEditorMode,
			{ type: "toggleLayers" },
			{ type: "openTextPicker", layerId: "text", key: "color" },
			{ type: "startTool", start: { tool: "redact" } },
		);
		assert.deepEqual(state.mode, {
			type: "tool",
			tool: "redact",
			optionsOpen: false,
		});
		assert.equal(state.sheet, null);
		assert.equal(state.textPicker, null);

		const adjusting = run(
			initialEditorMode,
			{ type: "toggleLayers" },
			{ type: "startTool", start: { tool: "adjust", layerId: "photo" } },
		);
		assert.deepEqual(adjusting.mode, {
			type: "tool",
			tool: "adjust",
			layerId: "photo",
		});
		assert.equal(adjusting.sheet, null);

		const cutting = run(
			initialEditorMode,
			{ type: "toggleLayers" },
			{ type: "startTool", start: { tool: "cutOut", layerId: "photo" } },
			{ type: "toggleToolOptions" },
		);
		assert.deepEqual(cutting.mode, {
			type: "tool",
			tool: "cutOut",
			layerId: "photo",
			optionsOpen: true,
		});
		assert.equal(cutting.sheet, null);
	});

	test("typing closes the layers sheet, and cropping leaves it open", () => {
		const layers = run(initialEditorMode, { type: "toggleLayers" });
		const typing = run(layers, { type: "startText", edit: edit("text") });
		assert.equal(typing.sheet, null);
		const cropping = run(layers, { type: "startCrop" });
		assert.deepEqual(cropping.mode, { type: "crop" });
		assert.equal(cropping.sheet, "layers");
		assert.equal(run(cropping, { type: "endCrop" }).sheet, "layers");
	});

	test("ending a tool stops the eyedropper, and ends only a tool", () => {
		const picking = run(
			drawing,
			{ type: "toggleToolOptions" },
			{ type: "startEyedropper", eyedropper: eyedropper() },
		);
		const ended = run(picking, { type: "endTool" });
		assert.deepEqual(ended.mode, { type: "idle" });
		assert.equal(ended.eyedropper, null);

		const typing = run(
			initialEditorMode,
			{ type: "startText", edit: edit("text") },
			{ type: "startEyedropper", eyedropper: eyedropper() },
			{ type: "endTool" },
		);
		assert.equal(typing.mode.type, "text");
		assert.equal(typing.eyedropper, null);
	});

	test("a tool's tray opens and closes, and Adjust has none", () => {
		const open = run(drawing, { type: "toggleToolOptions" });
		assert.deepEqual(open.mode, {
			type: "tool",
			tool: "draw",
			optionsOpen: true,
		});
		assert.deepEqual(run(open, { type: "closeToolOptions" }), drawing);
		assert.deepEqual(run(open, { type: "toggleToolOptions" }), drawing);

		const adjusting = run(initialEditorMode, {
			type: "startTool",
			start: { tool: "adjust", layerId: "photo" },
		});
		assert.equal(run(adjusting, { type: "toggleToolOptions" }), adjusting);
	});

	test("the eyedropper closes the tray or picker it came from", () => {
		const picker = eyedropper();
		const fromTray = run(
			drawing,
			{ type: "toggleToolOptions" },
			{ type: "startEyedropper", eyedropper: picker },
		);
		assert.deepEqual(fromTray.mode, {
			type: "tool",
			tool: "draw",
			optionsOpen: false,
		});
		assert.equal(fromTray.eyedropper, picker);

		const fromText = run(
			initialEditorMode,
			{ type: "openTextPicker", layerId: "text", key: "outlineColor" },
			{ type: "startEyedropper", eyedropper: picker },
		);
		assert.equal(fromText.textPicker, null);
		assert.equal(fromText.eyedropper, picker);
	});

	test("the tray and a text color picker can open while the eyedropper waits", () => {
		const picker = eyedropper();
		const tray = run(
			drawing,
			{ type: "startEyedropper", eyedropper: picker },
			{ type: "toggleToolOptions" },
		);
		assert.equal(tray.eyedropper, picker);
		assert.equal(tray.mode.type === "tool" && tray.mode.tool, "draw");

		const text = run(
			initialEditorMode,
			{ type: "startEyedropper", eyedropper: picker },
			{ type: "openTextPicker", layerId: "text", key: "color" },
		);
		assert.equal(text.eyedropper, picker);
		assert.deepEqual(text.textPicker, { layerId: "text", key: "color" });
	});

	test("a pick that lands after another eyedropper started leaves that one", () => {
		const first = eyedropper();
		const second = eyedropper();
		const waiting = run(
			initialEditorMode,
			{ type: "startEyedropper", eyedropper: first },
			{ type: "startEyedropper", eyedropper: second },
		);
		assert.equal(
			run(waiting, { type: "stopEyedropper", eyedropper: first }),
			waiting,
		);
		assert.equal(
			run(waiting, { type: "stopEyedropper", eyedropper: second }).eyedropper,
			null,
		);
		assert.equal(run(waiting, { type: "stopEyedropper" }).eyedropper, null);
	});

	test("starting anything stops the eyedropper", () => {
		const waiting = run(initialEditorMode, {
			type: "startEyedropper",
			eyedropper: eyedropper(),
		});
		for (const action of [
			{ type: "startTool", start: { tool: "draw" } },
			{ type: "startTool", start: { tool: "adjust", layerId: "photo" } },
			{ type: "startText", edit: edit("text") },
			{ type: "startCrop" },
			{ type: "openStickers" },
		] satisfies EditorModeAction[]) {
			assert.equal(run(waiting, action).eyedropper, null, action.type);
		}
	});

	test("text changes only while typing, and ends with it", () => {
		const change = (text: string): EditorModeAction => ({
			type: "changeText",
			change: (current) => ({
				...current,
				layer: { ...current.layer, text },
			}),
		});
		assert.equal(run(initialEditorMode, change("x")), initialEditorMode);

		const started = edit("text");
		const typing = run(
			initialEditorMode,
			{ type: "startText", edit: started },
			change("HELLO"),
		);
		assert.deepEqual(typing.mode, {
			type: "text",
			edit: { ...started, layer: { ...started.layer, text: "HELLO" } },
		});
		assert.deepEqual(run(typing, { type: "endText" }).mode, { type: "idle" });
	});

	test("Stickers replaces the layers sheet, and closing one leaves the other", () => {
		const stickers = run(
			initialEditorMode,
			{ type: "toggleLayers" },
			{ type: "openStickers" },
		);
		assert.equal(stickers.sheet, "stickers");
		assert.equal(run(stickers, { type: "closeLayers" }), stickers);
		assert.equal(
			run(stickers, { type: "startTool", start: { tool: "draw" } }).sheet,
			"stickers",
		);
		assert.equal(run(stickers, { type: "closeStickers" }).sheet, null);
	});

	test("closing what's already closed changes nothing", () => {
		for (const type of [
			"closeToolOptions",
			"closeTextPicker",
			"stopEyedropper",
			"closeLayers",
			"closeStickers",
			"closeShortcuts",
			"endText",
			"endCrop",
		] as const) {
			assert.equal(
				run(initialEditorMode, { type }),
				initialEditorMode,
				`${type} made a new state`,
			);
		}
		assert.equal(run(drawing, { type: "closeToolOptions" }), drawing);
	});
});

describe("settle", () => {
	const adjusting = run(initialEditorMode, {
		type: "startTool",
		start: { tool: "adjust", layerId: "photo" },
	});

	test("puts Adjust down when its image is gone or hidden", () => {
		assert.equal(settle(adjusting, targets()), adjusting);
		const settled = settle(
			adjusting,
			targets({ isAdjustable: (id) => id !== "photo" }),
		);
		assert.deepEqual(settled.mode, { type: "idle" });
	});

	test("puts Cut out down when its image is gone or hidden", () => {
		const cutting = run(initialEditorMode, {
			type: "startTool",
			start: { tool: "cutOut", layerId: "photo" },
		});
		assert.equal(settle(cutting, targets()), cutting);
		const settled = settle(
			cutting,
			targets({ isAdjustable: (id) => id !== "photo" }),
		);
		assert.deepEqual(settled.mode, { type: "idle" });
	});

	test("puts Find down with no photo left, and its tray with it", () => {
		const finding = run(
			initialEditorMode,
			{ type: "startTool", start: { tool: "find" } },
			{ type: "toggleToolOptions" },
		);
		assert.equal(settle(finding, targets()), finding);
		const settled = settle(finding, targets({ canFind: false }));
		assert.deepEqual(settled.mode, { type: "idle" });
		assert.deepEqual(
			run(settled, { type: "startTool", start: { tool: "draw" } }).mode,
			{
				type: "tool",
				tool: "draw",
				optionsOpen: false,
			},
		);
		assert.equal(settle(drawing, targets({ canFind: false })), drawing);
	});

	test("closes a text color picker when other text is styled", () => {
		const picking = run(initialEditorMode, {
			type: "openTextPicker",
			layerId: "a",
			key: "color",
		});
		assert.equal(settle(picking, targets({ selectedTextId: "a" })), picking);
		assert.equal(
			settle(picking, targets({ selectedTextId: "b" })).textPicker,
			null,
		);
		assert.equal(settle(picking, targets()).textPicker, null);
	});

	test("styles the text being typed rather than the selection", () => {
		const typing = run(
			initialEditorMode,
			{ type: "startText", edit: edit("new") },
			{ type: "openTextPicker", layerId: "new", key: "backgroundColor" },
		);
		assert.equal(settle(typing, targets({ selectedTextId: "a" })), typing);
	});

	test("a picker that closed stays closed when its text comes back", () => {
		const settled = run(
			initialEditorMode,
			{ type: "openTextPicker", layerId: "a", key: "color" },
			{ type: "settle", targets: targets({ selectedTextId: "b" }) },
			{ type: "settle", targets: targets({ selectedTextId: "a" }) },
		);
		assert.equal(settled.textPicker, null);
	});
});

describe("openTray", () => {
	test("is the tool whose tray is open", () => {
		assert.equal(openTray({ type: "idle" }), null);
		assert.equal(openTray({ type: "crop" }), null);
		assert.equal(openTray({ type: "text", edit: edit("text") }), null);
		assert.equal(
			openTray({ type: "tool", tool: "draw", optionsOpen: false }),
			null,
		);
		assert.equal(
			openTray({ type: "tool", tool: "draw", optionsOpen: true }),
			"draw",
		);
		assert.equal(
			openTray({ type: "tool", tool: "adjust", layerId: "photo" }),
			null,
		);
		assert.equal(
			openTray({
				type: "tool",
				tool: "cutOut",
				layerId: "photo",
				optionsOpen: true,
			}),
			"cutOut",
		);
	});
});

describe("toolImageId", () => {
	const adjusting = {
		type: "tool",
		tool: "adjust",
		layerId: "photo",
	} as const;
	const cutting = {
		type: "tool",
		tool: "cutOut",
		layerId: "photo",
		optionsOpen: false,
	} as const;

	test("is the image Adjust or Cut out works on", () => {
		assert.equal(toolImageId(adjusting, "adjust"), "photo");
		assert.equal(toolImageId(adjusting, "cutOut"), null);
		assert.equal(toolImageId(cutting, "cutOut"), "photo");
		assert.equal(toolImageId(cutting, "adjust"), null);
		assert.equal(
			toolImageId({ type: "tool", tool: "draw", optionsOpen: false }, "adjust"),
			null,
		);
		assert.equal(toolImageId({ type: "idle" }, "cutOut"), null);
	});
});

describe("takesKeys", () => {
	test("typing and cropping take the keys", () => {
		assert.equal(takesKeys({ type: "text", edit: edit("text") }), true);
		assert.equal(takesKeys({ type: "crop" }), true);
		assert.equal(takesKeys({ type: "idle" }), false);
		assert.equal(takesKeys(drawing.mode), false);
	});
});

describe("shortcutCommand", () => {
	const help: Shortcut = { type: "help" };
	const undo: Shortcut = { type: "undo" };
	const redo: Shortcut = { type: "redo" };
	const esc: Shortcut = { type: "deselect" };
	const zoom: Shortcut = { type: "zoom", to: "in" };
	const draw: Shortcut = { type: "tool", tool: "draw" };
	const sticker: Shortcut = { type: "tool", tool: "sticker" };
	const layers: Shortcut = { type: "layers" };
	const edit: Shortcut = { type: "edit" };
	const remove: Shortcut = { type: "delete" };
	const nudge: Shortcut = { type: "nudge", dx: 1, dy: 0 };
	const listOpen = run(initialEditorMode, { type: "openShortcuts" });
	const stickers = run(initialEditorMode, { type: "openStickers" });
	const picking = run(initialEditorMode, {
		type: "startEyedropper",
		eyedropper: eyedropper(),
	});

	test("the list of shortcuts closes with ? or Escape, and holds every other key", () => {
		assert.deepEqual(shortcutCommand(listOpen, null, help), {
			type: "closeShortcuts",
		});
		assert.deepEqual(shortcutCommand(listOpen, "layer", esc), {
			type: "closeShortcuts",
		});
		for (const key of [undo, draw, zoom, remove]) {
			assert.equal(shortcutCommand(listOpen, "layer", key), "held");
		}
	});

	test("? opens the list over anything", () => {
		for (const state of [initialEditorMode, drawing, stickers, picking]) {
			assert.deepEqual(shortcutCommand(state, null, help), {
				type: "openShortcuts",
			});
		}
	});

	test("undo and redo run over a tool, the Stickers sheet, and the eyedropper", () => {
		for (const state of [drawing, stickers, picking]) {
			assert.equal(shortcutCommand(state, null, undo), undo);
			assert.equal(shortcutCommand(state, null, redo), redo);
		}
	});

	test("Export runs over a tool and the eyedropper, but not the Stickers sheet", () => {
		const exporting: Shortcut = { type: "export" };
		for (const state of [initialEditorMode, drawing, picking]) {
			assert.equal(shortcutCommand(state, null, exporting), exporting);
		}
		assert.equal(shortcutCommand(stickers, null, exporting), null);
	});

	test("the Stickers sheet closes with Escape or A, and lets other keys pass", () => {
		assert.deepEqual(shortcutCommand(stickers, null, esc), {
			type: "closeStickers",
		});
		assert.deepEqual(shortcutCommand(stickers, null, sticker), {
			type: "closeStickers",
		});
		for (const key of [draw, zoom, layers, remove]) {
			assert.equal(shortcutCommand(stickers, "layer", key), null);
		}
	});

	test("zoom runs over the eyedropper and a tool", () => {
		assert.equal(shortcutCommand(picking, null, zoom), zoom);
		assert.equal(shortcutCommand(drawing, null, zoom), zoom);
	});

	test("while the eyedropper waits, Escape stops it and other keys pass", () => {
		const both = run(drawing, {
			type: "startEyedropper",
			eyedropper: eyedropper(),
		});
		assert.deepEqual(shortcutCommand(both, "layer", esc), {
			type: "stopEyedropper",
		});
		for (const key of [draw, layers, remove]) {
			assert.equal(shortcutCommand(picking, "layer", key), null);
		}
	});

	test("with a tool open, Escape is Done and other keys pass", () => {
		assert.deepEqual(shortcutCommand(drawing, "layer", esc), {
			type: "doneWithTool",
		});
		for (const key of [draw, layers, remove, nudge]) {
			assert.equal(shortcutCommand(drawing, "layer", key), null);
		}
	});

	test("[ and ] step a brush while Draw, Redact, or Cut out is open", () => {
		const smaller = { type: "brushSize", step: -1 } as const;
		const larger = { type: "brushSize", step: 1 } as const;
		assert.deepEqual(shortcutCommand(drawing, null, smaller), smaller);
		assert.deepEqual(
			shortcutCommand(
				run(initialEditorMode, {
					type: "startTool",
					start: { tool: "redact" },
				}),
				null,
				larger,
			),
			larger,
		);
		assert.deepEqual(
			shortcutCommand(
				run(initialEditorMode, {
					type: "startTool",
					start: { tool: "cutOut", layerId: "image" },
				}),
				null,
				smaller,
			),
			smaller,
		);
		assert.equal(
			shortcutCommand(
				run(initialEditorMode, { type: "startTool", start: { tool: "find" } }),
				null,
				smaller,
			),
			null,
		);
		assert.equal(shortcutCommand(initialEditorMode, "layer", smaller), null);
	});

	test("tool keys and L work with nothing selected; the rest pass", () => {
		assert.equal(shortcutCommand(initialEditorMode, null, draw), draw);
		assert.equal(shortcutCommand(initialEditorMode, null, sticker), sticker);
		assert.equal(shortcutCommand(initialEditorMode, null, layers), layers);
		for (const key of [esc, remove, edit, nudge]) {
			assert.equal(shortcutCommand(initialEditorMode, null, key), null);
		}
	});

	test("the selection keys act on a selection, and E only on text", () => {
		for (const key of [esc, remove, nudge]) {
			assert.equal(shortcutCommand(initialEditorMode, "layer", key), key);
		}
		assert.equal(shortcutCommand(initialEditorMode, "layer", edit), null);
		assert.equal(shortcutCommand(initialEditorMode, "text", edit), edit);
	});
});
