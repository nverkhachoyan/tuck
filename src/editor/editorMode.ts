// What the editor is doing, and what's open over it. Plain TypeScript, so
// the rules for what can be on together are tested; `useEditorMode` holds
// the state for the screen.

import type { TextSelection } from "@tuck/skia-text-input";
import type { Rect } from "../model/geometry.ts";
import type { TextLayer } from "../model/layers/text.ts";
import type { Shortcut } from "./shortcuts.ts";
import type { ToolId, ToolSpecs } from "./toolSpec.ts";

/** A text layer's colors, which its Color, Outline, and Box tabs pick. */
export type TextColorKey = "color" | "outlineColor" | "backgroundColor";

// While set, the canvas's next tap picks a color from what it shows, for
// `apply` to give to whatever asked for it.
export type Eyedropper = { apply: (color: string) => void };

/**
 * Text being edited in place: its layer as typed so far, which is drawn in
 * place of the document's (or on top when `isNew`: it's added once editing
 * ends), and its caret or selection. The caret shows while `focused`.
 * What's typed and restyled meanwhile stays here, so the whole edit is one
 * undo step.
 */
export type TextEditState = {
	layer: TextLayer;
	isNew: boolean;
	selection: TextSelection;
	focused: boolean;
	// Where the caret starts, once the input first has focus.
	initialSelection: TextSelection;
	// New text is placed in `area`, the part of the photo in view when it began.
	area?: Rect;
};

/**
 * A tool's mode. `layerId` is the image it started on, for a tool whose
 * spec's target is "image", and null for the rest; `optionsOpen` is whether
 * its tray is open, and stays false for a tool without one.
 */
export type ToolMode = {
	type: "tool";
	tool: ToolId;
	layerId: string | null;
	optionsOpen: boolean;
};

/**
 * What the canvas and the dock are given over to, one at a time: nothing, a
 * tool in the dock (see `ToolMode`), or text being typed on the canvas.
 */
export type EditorMode =
	| { type: "idle" }
	| ToolMode
	| { type: "text"; edit: TextEditState };

/** A tool to start, with the image it would work on, if any. */
export type ToolStart = { tool: ToolId; layerId: string | null };

/**
 * The mode, and what sits over it. A text color picker belongs to a layer,
 * and closes when that text isn't the one styled. The eyedropper waits for a
 * tap on the canvas over any mode, and either can be open with a tool's
 * tray. The layers sheet, and the list of shortcuts, open over everything.
 */
export type EditorModeState = {
	mode: EditorMode;
	textPicker: { layerId: string; key: TextColorKey } | null;
	eyedropper: Eyedropper | null;
	sheet: "layers" | null;
	shortcutsOpen: boolean;
};

export const initialEditorMode: EditorModeState = {
	mode: { type: "idle" },
	textPicker: null,
	eyedropper: null,
	sheet: null,
	shortcutsOpen: false,
};

// What `settle` checks the mode against.
export type ModeTargets = {
	// Whether an image can still be worked on: it's there, and shown.
	isAdjustable: (layerId: string) => boolean;
	// Whether there's a photo to work in.
	hasPhoto: boolean;
	// The selected text, which the dock styles while nothing is typed.
	selectedTextId: string | null;
};

export type EditorModeAction =
	| { type: "startTool"; start: ToolStart }
	| { type: "endTool" }
	| { type: "toggleToolOptions" }
	| { type: "closeToolOptions" }
	| { type: "startText"; edit: TextEditState }
	| { type: "changeText"; change: (edit: TextEditState) => TextEditState }
	| { type: "endText" }
	| { type: "openTextPicker"; layerId: string; key: TextColorKey }
	| { type: "closeTextPicker" }
	| { type: "startEyedropper"; eyedropper: Eyedropper }
	| { type: "stopEyedropper"; eyedropper?: Eyedropper }
	| { type: "toggleLayers" }
	| { type: "closeLayers" }
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "settle"; targets: ModeTargets };

const idle = { type: "idle" } as const;

/**
 * Starting a tool or typing closes the layers sheet. A tool starts with its
 * tray closed, and closes a text color picker. Starting anything, and
 * ending a tool, stops the eyedropper: what it was picking for has moved on.
 * What a tool's mode holds follows its spec in `specs`.
 */
export function editorModeReducer(
	state: EditorModeState,
	action: EditorModeAction,
	specs: ToolSpecs,
): EditorModeState {
	const { mode } = state;
	switch (action.type) {
		case "startTool":
			return {
				...state,
				mode: toolMode(action.start, specs),
				textPicker: null,
				eyedropper: null,
				sheet: null,
			};
		case "endTool":
			return {
				...state,
				mode: mode.type === "tool" ? idle : mode,
				eyedropper: null,
			};
		case "toggleToolOptions":
			return mode.type === "tool" && specs[mode.tool]?.tray
				? { ...state, mode: { ...mode, optionsOpen: !mode.optionsOpen } }
				: state;
		case "closeToolOptions":
			return mode.type === "tool" && mode.optionsOpen
				? { ...state, mode: { ...mode, optionsOpen: false } }
				: state;
		case "startText":
			return {
				...state,
				mode: { type: "text", edit: action.edit },
				eyedropper: null,
				sheet: null,
			};
		case "changeText":
			return mode.type === "text"
				? { ...state, mode: { ...mode, edit: action.change(mode.edit) } }
				: state;
		case "endText":
			return mode.type === "text" ? { ...state, mode: idle } : state;
		case "openTextPicker":
			return {
				...state,
				textPicker: { layerId: action.layerId, key: action.key },
			};
		case "closeTextPicker":
			return state.textPicker ? { ...state, textPicker: null } : state;
		// The tray or picker it came from closes meanwhile, so the canvas is
		// in view.
		case "startEyedropper":
			return {
				...state,
				mode:
					mode.type === "tool" && mode.optionsOpen
						? { ...mode, optionsOpen: false }
						: mode,
				textPicker: null,
				eyedropper: action.eyedropper,
			};
		// A pick that lands after another eyedropper started leaves that one
		// waiting.
		case "stopEyedropper":
			return state.eyedropper &&
				(!action.eyedropper || action.eyedropper === state.eyedropper)
				? { ...state, eyedropper: null }
				: state;
		case "toggleLayers":
			return { ...state, sheet: state.sheet === "layers" ? null : "layers" };
		case "closeLayers":
			return state.sheet === "layers" ? { ...state, sheet: null } : state;
		case "openShortcuts":
			return { ...state, shortcutsOpen: true };
		case "closeShortcuts":
			return state.shortcutsOpen ? { ...state, shortcutsOpen: false } : state;
		case "settle":
			return settle(state, action.targets, specs);
	}
}

/**
 * `state` with what's gone put away: a tool whose image is gone or hidden,
 * or that works in a photo when none is left (see `ToolSpec`'s `target`),
 * and a text color picker whose text isn't the one styled any more. The
 * same `state` when nothing is. A tool's target is its spec's in `specs`.
 */
export function settle(
	state: EditorModeState,
	targets: ModeTargets,
	specs: ToolSpecs,
): EditorModeState {
	const { mode, textPicker } = state;
	const toolGone = mode.type === "tool" && targetGone(mode, targets, specs);
	const styledTextId =
		mode.type === "text" ? mode.edit.layer.id : targets.selectedTextId;
	const pickerGone = textPicker !== null && textPicker.layerId !== styledTextId;
	if (!toolGone && !pickerGone) return state;
	return {
		...state,
		mode: toolGone ? idle : mode,
		textPicker: pickerGone ? null : textPicker,
	};
}

/**
 * Whether typing, or an open tool whose spec in `specs` says so, takes the
 * keyboard, and pasted and dropped photos, for itself.
 */
export function takesKeys(mode: EditorMode, specs: ToolSpecs): boolean {
	if (mode.type === "text") return true;
	return mode.type === "tool" && specs[mode.tool]?.takesKeys === true;
}

/** What a shortcut does, given what's open (see `shortcutCommand`). */
export type ShortcutCommand =
	| Exclude<Shortcut, { type: "help" }>
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "stopEyedropper" }
	| { type: "doneWithTool" };

/**
 * What `shortcut` does with `state` open and `selection` selected: a command
 * for the screen to carry out, "held" for a key used up doing nothing, or
 * null for a key left to the browser. The screen doesn't ask while typing or
 * while a tool that takes its own keys is open (see `takesKeys`). Whether the open
 * tool has a brush is its spec's in `specs`.
 */
export function shortcutCommand(
	state: EditorModeState,
	selection: "text" | "layer" | null,
	shortcut: Shortcut,
	specs: ToolSpecs,
): ShortcutCommand | "held" | null {
	// The list of shortcuts closes with its own key or Escape, and holds the
	// rest back.
	if (state.shortcutsOpen) {
		return shortcut.type === "help" || shortcut.type === "deselect"
			? { type: "closeShortcuts" }
			: "held";
	}
	if (shortcut.type === "help") return { type: "openShortcuts" };
	if (shortcut.type === "undo" || shortcut.type === "redo") return shortcut;
	// The view zooms whatever's in use, and Export takes it as it is, as the
	// header's button does.
	if (shortcut.type === "zoom" || shortcut.type === "export") return shortcut;
	// Escape stops picking a color, or puts the tool down; the rest pick up
	// another tool or act on a selection, which holds still while a tool is
	// in use.
	if (state.eyedropper) {
		return shortcut.type === "deselect" ? { type: "stopEyedropper" } : null;
	}
	if (state.mode.type === "tool") {
		if (shortcut.type === "deselect") return { type: "doneWithTool" };
		// [ and ] step a brush while a tool with one is open. A sub-tool with
		// no size, like a box, leaves the size where it is.
		if (shortcut.type === "brushSize" && specs[state.mode.tool]?.sized) {
			return shortcut;
		}
		return null;
	}
	if (shortcut.type === "brushSize") return null;
	if (shortcut.type === "tool" || shortcut.type === "layers") return shortcut;
	if (selection === null) return null;
	if (shortcut.type === "edit" && selection !== "text") return null;
	return shortcut;
}

// The mode a tool starts in, with its tray closed.
function toolMode(start: ToolStart, specs: ToolSpecs): ToolMode {
	const isImageTool = specs[start.tool]?.target === "image";
	return {
		type: "tool",
		tool: start.tool,
		layerId: isImageTool ? start.layerId : null,
		optionsOpen: false,
	};
}

// Whether what `mode` works on is gone.
function targetGone(
	mode: ToolMode,
	targets: ModeTargets,
	specs: ToolSpecs,
): boolean {
	switch (specs[mode.tool]?.target) {
		case "image":
			return mode.layerId !== null && !targets.isAdjustable(mode.layerId);
		case "photo":
			return !targets.hasPhoto;
		default:
			return false;
	}
}

/** The tool whose tray is open, or null when none is. */
export function openTray(mode: EditorMode) {
	return mode.type === "tool" && mode.optionsOpen ? mode.tool : null;
}
