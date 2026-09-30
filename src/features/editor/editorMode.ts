// What the editor is doing, and what's open over it. Plain TypeScript, so
// the rules for what can be on together are tested; `useEditorMode` holds
// the state for the screen.
import type { Shortcut } from "./shortcuts.ts";

/** A text layer's colors, which its Color, Outline, and Box tabs pick. */
export type TextColorKey = "color" | "outlineColor" | "backgroundColor";

// While set, the canvas's next tap picks a color from what it shows, for
// `apply` to give to whatever asked for it.
export type Eyedropper = { apply: (color: string) => void };

// All the mode needs to know of text being typed: which layer it is.
export type EditedText = { layer: { id: string } };

/**
 * What the canvas and the dock are given over to, one at a time: nothing, a
 * tool in the dock (Draw, Redact, and Find with their trays, and Adjust with
 * the image it started on), text being typed on the canvas, or the crop
 * screen.
 */
export type EditorMode<TextEdit> =
	| { type: "idle" }
	| { type: "tool"; tool: "draw" | "redact" | "find"; optionsOpen: boolean }
	| { type: "tool"; tool: "adjust"; layerId: string }
	| { type: "text"; edit: TextEdit }
	| { type: "crop" };

type TrayTool = Extract<EditorMode<never>, { optionsOpen: boolean }>;

/**
 * The mode, and what sits over it. A text color picker belongs to a layer,
 * and closes when that text isn't the one styled. The eyedropper waits for a
 * tap on the canvas over any mode, and either can be open with a tool's
 * tray. The layers or Add sheet, and the list of shortcuts, open over
 * everything.
 */
export type EditorModeState<TextEdit> = {
	mode: EditorMode<TextEdit>;
	textPicker: { layerId: string; key: TextColorKey } | null;
	eyedropper: Eyedropper | null;
	sheet: "layers" | "add" | null;
	shortcutsOpen: boolean;
};

export const initialEditorMode: EditorModeState<never> = {
	mode: { type: "idle" },
	textPicker: null,
	eyedropper: null,
	sheet: null,
	shortcutsOpen: false,
};

// What `settle` checks the mode against.
export type ModeTargets = {
	// Whether an image can still be adjusted: it's there, and shown.
	isAdjustable: (layerId: string) => boolean;
	// Whether there's a photo for Find to search.
	canFind: boolean;
	// The selected text, which the dock styles while nothing is typed.
	selectedTextId: string | null;
};

export type EditorModeAction<TextEdit> =
	| { type: "startTool"; tool: "draw" | "redact" | "find" }
	| { type: "startAdjust"; layerId: string }
	| { type: "endTool" }
	| { type: "toggleToolOptions" }
	| { type: "closeToolOptions" }
	| { type: "startText"; edit: TextEdit }
	| { type: "changeText"; change: (edit: TextEdit) => TextEdit }
	| { type: "endText" }
	| { type: "startCrop" }
	| { type: "endCrop" }
	| { type: "openTextPicker"; layerId: string; key: TextColorKey }
	| { type: "closeTextPicker" }
	| { type: "startEyedropper"; eyedropper: Eyedropper }
	| { type: "stopEyedropper"; eyedropper?: Eyedropper }
	| { type: "toggleLayers" }
	| { type: "closeLayers" }
	| { type: "openAdd" }
	| { type: "closeAdd" }
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "settle"; targets: ModeTargets };

const idle = { type: "idle" } as const;

/**
 * Starting a tool or typing closes the layers sheet. Cropping leaves it: the
 * crop screen covers it, and it's open again after. A tool starts with its
 * tray closed, and closes a text color picker. Starting anything, and
 * ending a tool, stops the eyedropper: what it was picking for has moved on.
 */
export function editorModeReducer<TextEdit extends EditedText>(
	state: EditorModeState<TextEdit>,
	action: EditorModeAction<TextEdit>,
): EditorModeState<TextEdit> {
	const { mode } = state;
	switch (action.type) {
		case "startTool":
			return {
				...state,
				mode: { type: "tool", tool: action.tool, optionsOpen: false },
				textPicker: null,
				eyedropper: null,
				sheet: withoutLayers(state.sheet),
			};
		case "startAdjust":
			return {
				...state,
				mode: { type: "tool", tool: "adjust", layerId: action.layerId },
				textPicker: null,
				eyedropper: null,
				sheet: withoutLayers(state.sheet),
			};
		case "endTool":
			return {
				...state,
				mode: mode.type === "tool" ? idle : mode,
				eyedropper: null,
			};
		case "toggleToolOptions":
			return hasTray(mode)
				? { ...state, mode: { ...mode, optionsOpen: !mode.optionsOpen } }
				: state;
		case "closeToolOptions":
			return hasTray(mode) && mode.optionsOpen
				? { ...state, mode: { ...mode, optionsOpen: false } }
				: state;
		case "startText":
			return {
				...state,
				mode: { type: "text", edit: action.edit },
				eyedropper: null,
				sheet: withoutLayers(state.sheet),
			};
		case "changeText":
			return mode.type === "text"
				? { ...state, mode: { ...mode, edit: action.change(mode.edit) } }
				: state;
		case "endText":
			return mode.type === "text" ? { ...state, mode: idle } : state;
		case "startCrop":
			return mode.type === "crop"
				? state
				: { ...state, mode: { type: "crop" }, eyedropper: null };
		case "endCrop":
			return mode.type === "crop" ? { ...state, mode: idle } : state;
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
				mode: hasTray(mode) ? { ...mode, optionsOpen: false } : mode,
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
		case "openAdd":
			return { ...state, sheet: "add", eyedropper: null };
		case "closeAdd":
			return state.sheet === "add" ? { ...state, sheet: null } : state;
		case "openShortcuts":
			return { ...state, shortcutsOpen: true };
		case "closeShortcuts":
			return state.shortcutsOpen ? { ...state, shortcutsOpen: false } : state;
		case "settle":
			return settle(state, action.targets);
	}
}

/**
 * `state` with what's gone put away: Adjust whose image is gone or hidden,
 * Find with no photo left to search, and a text color picker whose text
 * isn't the one styled any more. The same `state` when nothing is.
 */
export function settle<TextEdit extends EditedText>(
	state: EditorModeState<TextEdit>,
	targets: ModeTargets,
): EditorModeState<TextEdit> {
	const { mode, textPicker } = state;
	const toolGone =
		mode.type === "tool" &&
		(mode.tool === "adjust"
			? !targets.isAdjustable(mode.layerId)
			: mode.tool === "find" && !targets.canFind);
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

// Typing and cropping take the keyboard, and pasted photos, for themselves.
export function takesKeys(mode: EditorMode<unknown>): boolean {
	return mode.type === "text" || mode.type === "crop";
}

/** What a shortcut does, given what's open (see `shortcutCommand`). */
export type ShortcutCommand =
	| Exclude<Shortcut, { type: "help" }>
	| { type: "openShortcuts" }
	| { type: "closeShortcuts" }
	| { type: "closeAdd" }
	| { type: "stopEyedropper" }
	| { type: "doneWithTool" };

/**
 * What `shortcut` does with `state` open and `selection` selected: a command
 * for the screen to carry out, "held" for a key used up doing nothing, or
 * null for a key left to the browser. The screen doesn't ask while typing or
 * cropping, which take their own keys (see `takesKeys`).
 */
export function shortcutCommand(
	state: EditorModeState<unknown>,
	selection: "text" | "layer" | null,
	shortcut: Shortcut,
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
	// The Add sheet's own key, or Escape, closes it; the rest wait.
	if (state.sheet === "add") {
		const closes =
			shortcut.type === "deselect" ||
			(shortcut.type === "tool" && shortcut.tool === "add");
		return closes ? { type: "closeAdd" } : null;
	}
	// The view zooms whatever's in use.
	if (shortcut.type === "zoom") return shortcut;
	// Escape stops picking a color, or puts the tool down; the rest pick up
	// another tool or act on a selection, which holds still while a tool is
	// in use.
	if (state.eyedropper) {
		return shortcut.type === "deselect" ? { type: "stopEyedropper" } : null;
	}
	if (state.mode.type === "tool") {
		return shortcut.type === "deselect" ? { type: "doneWithTool" } : null;
	}
	if (shortcut.type === "tool" || shortcut.type === "layers") return shortcut;
	if (selection === null) return null;
	if (shortcut.type === "edit" && selection !== "text") return null;
	return shortcut;
}

function hasTray<TextEdit>(mode: EditorMode<TextEdit>): mode is TrayTool {
	return mode.type === "tool" && mode.tool !== "adjust";
}

function withoutLayers(
	sheet: EditorModeState<unknown>["sheet"],
): EditorModeState<unknown>["sheet"] {
	return sheet === "layers" ? null : sheet;
}
