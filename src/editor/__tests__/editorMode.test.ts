/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTextLayer } from "../../model/layers/text.ts";
import { BUILT_IN_SPECS } from "../builtInSpecs.ts";
import {
	type EditorModeAction,
	type EditorModeState,
	type Eyedropper,
	editorModeReducer,
	initialEditorMode,
	type ModeTargets,
	openTray,
	type ShortcutCommand,
	settle as settleWith,
	shortcutCommand,
	type TextEditState,
	takesKeys,
} from "../editorMode.ts";
import type { Shortcut } from "../shortcuts.ts";
import type { ToolSpec, ToolSpecs } from "../toolSpec.ts";

type State = EditorModeState;

const specs: ToolSpecs = BUILT_IN_SPECS;

const run = (state: State, ...actions: EditorModeAction[]) =>
	actions.reduce(
		(current: State, action) => editorModeReducer(current, action, specs),
		state,
	);
const settle = (state: State, targets: ModeTargets) =>
	settleWith(state, targets, specs);
const command = (
	state: State,
	selection: "text" | "layer" | null,
	shortcut: Shortcut,
): ShortcutCommand | "held" | null =>
	shortcutCommand(state, selection, shortcut, specs);

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
	hasPhoto: true,
	selectedTextId: null,
	...overrides,
});

const drawing = run(initialEditorMode, {
	type: "startTool",
	start: { tool: "draw", layerId: null },
});

describe("editorModeReducer", () => {
	test("starting a tool closes the layers sheet and a text color picker", () => {
		const state = run(
			initialEditorMode,
			{ type: "toggleLayers" },
			{ type: "openTextPicker", layerId: "text", key: "color" },
			{ type: "startTool", start: { tool: "redact", layerId: null } },
		);
		assert.deepEqual(state.mode, {
			type: "tool",
			tool: "redact",
			layerId: null,
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
			optionsOpen: false,
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

	test("typing and cropping close the layers sheet", () => {
		const layers = run(initialEditorMode, { type: "toggleLayers" });
		const typing = run(layers, { type: "startText", edit: edit("text") });
		assert.equal(typing.sheet, null);
		const cropping = run(layers, {
			type: "startTool",
			start: { tool: "crop", layerId: "photo" },
		});
		assert.deepEqual(cropping.mode, {
			type: "tool",
			tool: "crop",
			layerId: null,
			optionsOpen: false,
		});
		assert.equal(cropping.sheet, null);
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
			layerId: null,
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
			layerId: null,
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
			{ type: "startTool", start: { tool: "draw", layerId: null } },
			{ type: "startTool", start: { tool: "adjust", layerId: "photo" } },
			{ type: "startText", edit: edit("text") },
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
			run(stickers, {
				type: "startTool",
				start: { tool: "draw", layerId: null },
			}).sheet,
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

describe("a made-up tool's mode", () => {
	const made = (spec: Partial<ToolSpec>): ToolSpec => ({
		target: "none",
		tray: false,
		sized: false,
		label: "Ruler",
		icon: "ruler",
		key: "U",
		shortcut: "Measure",
		actsOn: () => false,
		...spec,
	});
	const withRuler = (spec: Partial<ToolSpec>) => {
		const rulerSpecs = { ...specs, ruler: made(spec) };
		return (state: State, action: EditorModeAction) =>
			editorModeReducer(state, action, rulerSpecs);
	};
	const start: EditorModeAction = {
		type: "startTool",
		start: { tool: "ruler", layerId: "photo" },
	};

	test("keeps its image only when its target is one", () => {
		for (const target of ["none", "photo"] as const) {
			const { mode }: State = withRuler({ target })(initialEditorMode, start);
			assert.equal(mode.type === "tool" && mode.layerId, null, target);
		}
		const onImage = withRuler({ target: "image" })(initialEditorMode, start);
		assert.deepEqual(onImage.mode, {
			type: "tool",
			tool: "ruler",
			layerId: "photo",
			optionsOpen: false,
		});
	});

	test("opens a tray only when its spec has one", () => {
		const without = withRuler({});
		const started = without(initialEditorMode, start);
		assert.equal(without(started, { type: "toggleToolOptions" }), started);
		const withTray = withRuler({ tray: true });
		const open = withTray(withTray(initialEditorMode, start), {
			type: "toggleToolOptions",
		});
		assert.equal(openTray(open.mode), "ruler");
	});

	test("is put down when its image goes, and steps a brush when sized", () => {
		const rulerSpecs = {
			...specs,
			ruler: made({ target: "image", sized: true }),
		};
		const started = editorModeReducer(initialEditorMode, start, rulerSpecs);
		const gone = settleWith(
			started,
			targets({ isAdjustable: () => false }),
			rulerSpecs,
		);
		assert.deepEqual(gone.mode, { type: "idle" });
		const larger = { type: "brushSize", step: 1 } as const;
		assert.deepEqual(
			shortcutCommand(started, null, larger, rulerSpecs),
			larger,
		);
		assert.equal(shortcutCommand(started, null, larger, specs), null);
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
			{ type: "startTool", start: { tool: "find", layerId: null } },
			{ type: "toggleToolOptions" },
		);
		assert.equal(settle(finding, targets()), finding);
		const settled = settle(finding, targets({ hasPhoto: false }));
		assert.deepEqual(settled.mode, { type: "idle" });
		assert.deepEqual(
			run(settled, {
				type: "startTool",
				start: { tool: "draw", layerId: null },
			}).mode,
			{
				type: "tool",
				tool: "draw",
				layerId: null,
				optionsOpen: false,
			},
		);
		assert.equal(settle(drawing, targets({ hasPhoto: false })), drawing);
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
		assert.equal(openTray({ type: "text", edit: edit("text") }), null);
		assert.equal(
			openTray({
				type: "tool",
				tool: "draw",
				layerId: null,
				optionsOpen: false,
			}),
			null,
		);
		assert.equal(
			openTray({
				type: "tool",
				tool: "draw",
				layerId: null,
				optionsOpen: true,
			}),
			"draw",
		);
		assert.equal(
			openTray({
				type: "tool",
				tool: "adjust",
				layerId: "photo",
				optionsOpen: false,
			}),
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

describe("takesKeys", () => {
	test("typing and a tool whose spec says so take the keys", () => {
		const cropping = run(initialEditorMode, {
			type: "startTool",
			start: { tool: "crop", layerId: null },
		});
		const keys = (mode: EditorModeState["mode"]) =>
			takesKeys(mode, BUILT_IN_SPECS);
		assert.equal(keys({ type: "text", edit: edit("text") }), true);
		assert.equal(keys(cropping.mode), true);
		assert.equal(keys({ type: "idle" }), false);
		assert.equal(keys(drawing.mode), false);
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
		assert.deepEqual(command(listOpen, null, help), {
			type: "closeShortcuts",
		});
		assert.deepEqual(command(listOpen, "layer", esc), {
			type: "closeShortcuts",
		});
		for (const key of [undo, draw, zoom, remove]) {
			assert.equal(command(listOpen, "layer", key), "held");
		}
	});

	test("? opens the list over anything", () => {
		for (const state of [initialEditorMode, drawing, stickers, picking]) {
			assert.deepEqual(command(state, null, help), {
				type: "openShortcuts",
			});
		}
	});

	test("undo and redo run over a tool, the Stickers sheet, and the eyedropper", () => {
		for (const state of [drawing, stickers, picking]) {
			assert.equal(command(state, null, undo), undo);
			assert.equal(command(state, null, redo), redo);
		}
	});

	test("Export runs over a tool and the eyedropper, but not the Stickers sheet", () => {
		const exporting: Shortcut = { type: "export" };
		for (const state of [initialEditorMode, drawing, picking]) {
			assert.equal(command(state, null, exporting), exporting);
		}
		assert.equal(command(stickers, null, exporting), null);
	});

	test("the Stickers sheet closes with Escape or A, and lets other keys pass", () => {
		assert.deepEqual(command(stickers, null, esc), {
			type: "closeStickers",
		});
		assert.deepEqual(command(stickers, null, sticker), {
			type: "closeStickers",
		});
		for (const key of [draw, zoom, layers, remove]) {
			assert.equal(command(stickers, "layer", key), null);
		}
	});

	test("zoom runs over the eyedropper and a tool", () => {
		assert.equal(command(picking, null, zoom), zoom);
		assert.equal(command(drawing, null, zoom), zoom);
	});

	test("while the eyedropper waits, Escape stops it and other keys pass", () => {
		const both = run(drawing, {
			type: "startEyedropper",
			eyedropper: eyedropper(),
		});
		assert.deepEqual(command(both, "layer", esc), {
			type: "stopEyedropper",
		});
		for (const key of [draw, layers, remove]) {
			assert.equal(command(picking, "layer", key), null);
		}
	});

	test("with a tool open, Escape is Done and other keys pass", () => {
		assert.deepEqual(command(drawing, "layer", esc), {
			type: "doneWithTool",
		});
		for (const key of [draw, layers, remove, nudge]) {
			assert.equal(command(drawing, "layer", key), null);
		}
	});

	test("[ and ] step a brush while Draw, Redact, or Cut out is open", () => {
		const smaller = { type: "brushSize", step: -1 } as const;
		const larger = { type: "brushSize", step: 1 } as const;
		assert.deepEqual(command(drawing, null, smaller), smaller);
		assert.deepEqual(
			command(
				run(initialEditorMode, {
					type: "startTool",
					start: { tool: "redact", layerId: null },
				}),
				null,
				larger,
			),
			larger,
		);
		assert.deepEqual(
			command(
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
			command(
				run(initialEditorMode, {
					type: "startTool",
					start: { tool: "find", layerId: null },
				}),
				null,
				smaller,
			),
			null,
		);
		assert.equal(command(initialEditorMode, "layer", smaller), null);
	});

	test("tool keys and L work with nothing selected; the rest pass", () => {
		assert.equal(command(initialEditorMode, null, draw), draw);
		assert.equal(command(initialEditorMode, null, sticker), sticker);
		assert.equal(command(initialEditorMode, null, layers), layers);
		for (const key of [esc, remove, edit, nudge]) {
			assert.equal(command(initialEditorMode, null, key), null);
		}
	});

	test("the selection keys act on a selection, and E only on text", () => {
		for (const key of [esc, remove, nudge]) {
			assert.equal(command(initialEditorMode, "layer", key), key);
		}
		assert.equal(command(initialEditorMode, "layer", edit), null);
		assert.equal(command(initialEditorMode, "text", edit), edit);
	});
});
