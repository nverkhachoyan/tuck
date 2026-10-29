// What the editor is doing, and what's open over it. Plain TypeScript, so
// the rules for what can be on together are tested; `useEditorMode` holds
// the state for the screen.

import type { Shortcut } from "./shortcuts.ts";
import type { ToolId, ToolSpecs } from "./toolSpec.ts";

// While set, the canvas's next tap picks a color from what it shows, for
// `apply` to give to whatever asked for it.
export type Eyedropper = { apply: (color: string) => void };

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
 * What the canvas and the dock are given over to, one at a time: nothing,
 * or a tool (see `ToolMode`).
 */
export type EditorMode = { type: "idle" } | ToolMode;

/** A tool to start, with the image it would work on, if any. */
export type ToolStart = { tool: ToolId; layerId: string | null };

/**
 * The mode, and what sits over it. The eyedropper waits for a tap on the
 * canvas over any mode, and can be open with a tool's tray. The layers
 * sheet, and the list of shortcuts, open over everything.
 */
export type EditorModeState = {
	mode: EditorMode;
	eyedropper: Eyedropper | null;
	sheet: "layers" | null;
	shortcutsOpen: boolean;
};

export const initialEditorMode: EditorModeState = {
	mode: { type: "idle" },
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
};

export type EditorModeAction =
	| { type: "startTool"; start: ToolStart }
	| { type: "endTool" }
	| { type: "toggleToolOptions" }
	| { type: "closeToolOptions" }
	| { type: "startEyedropper"; eyedropper: Eyedropper }
	| { type: "stopEyedropper"; eyedropper?: Eyedropper }
	| { type: "toggleLayers" }
	| { type: "closeLayers" }
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "settle"; targets: ModeTargets };

const idle = { type: "idle" } as const;

/**
 * Starting a tool closes the layers sheet, and starts it with its tray
 * closed. Starting and ending a tool stop the eyedropper: what it was
 * picking for has moved on.
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
		// The tray it came from closes meanwhile, so the canvas is in view.
		case "startEyedropper":
			return {
				...state,
				mode:
					mode.type === "tool" && mode.optionsOpen
						? { ...mode, optionsOpen: false }
						: mode,
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
 * `state` with a tool put away whose image is gone or hidden, or that works
 * in a photo when none is left (see `ToolSpec`'s `target`). The same
 * `state` when nothing is. A tool's target is its spec's in `specs`.
 */
export function settle(
	state: EditorModeState,
	targets: ModeTargets,
	specs: ToolSpecs,
): EditorModeState {
	const { mode } = state;
	if (mode.type !== "tool" || !targetGone(mode, targets, specs)) return state;
	return { ...state, mode: idle };
}

/**
 * Whether an open tool whose spec in `specs` says so takes the keyboard,
 * and pasted and dropped photos, for itself.
 */
export function takesKeys(mode: EditorMode, specs: ToolSpecs): boolean {
	return mode.type === "tool" && specs[mode.tool]?.takesKeys !== undefined;
}

/** What a shortcut does, given what's open (see `shortcutCommand`). */
export type ShortcutCommand =
	| Exclude<Shortcut, { type: "help" }>
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "stopEyedropper" }
	| { type: "doneWithTool" };

/**
 * What `shortcut` does with `state` open and `selection` selected (a layer
 * a tool edits in place is "editable"): a command for the screen to carry
 * out, "held" for a key used up doing nothing, or null for a key left to
 * the browser. The screen doesn't ask while a tool that takes its own keys
 * is open (see `takesKeys`). Whether the open tool has a brush is its
 * spec's in `specs`.
 */
export function shortcutCommand(
	state: EditorModeState,
	selection: "editable" | "layer" | null,
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
	if (shortcut.type === "edit" && selection !== "editable") return null;
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
