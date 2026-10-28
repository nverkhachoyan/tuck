import { useEffect, useEffectEvent } from "react";
import { Platform } from "react-native";
import { assertNever } from "@/model/assertNever";
import {
	type EditorModeAction,
	type EditorModeState,
	type ShortcutCommand,
	shortcutCommand,
} from "./editorMode";
import type { ArrangeMove } from "./shell/SelectionBar";
import type { ToolStarters } from "./shell/ToolsPanel";
import { type Shortcut, shortcutFor } from "./shortcuts";
import type { ToolSpecs } from "./toolSpec";

/**
 * The editor's keyboard shortcuts on web (see `shortcutFor`), only while
 * `enabled`: while the editor is focused, so they can't change the document
 * from Export, and not while a text input keeps its own keys. Keys typed into
 * any other field, like an alert's, are that field's too.
 *
 * Which shortcut does what, given what's open, is `shortcutCommand`'s. A
 * key the editor acts on is taken, and one it doesn't use keeps its browser
 * default (arrows scroll, for one), except with ⌘/Ctrl held: those are the
 * editor's either way, rather than bookmarking the page or going back in
 * history.
 */
export function useEditorShortcuts({
	specs,
	toolsByKey,
	enabled,
	modeState,
	selection,
	dispatchMode,
	undo,
	redo,
	openExport,
	zoom,
	done,
	startTool,
	editSelected,
	deleteSelected,
	deselect,
	duplicate,
	arrange,
	nudge,
	stepBrush,
}: {
	specs: ToolSpecs;
	toolsByKey: ReadonlyMap<string, string>;
	enabled: boolean;
	modeState: EditorModeState;
	selection: "text" | "layer" | null;
	dispatchMode: (action: EditorModeAction) => void;
	undo: () => void;
	redo: () => void;
	openExport: () => void;
	zoom: (to: "in" | "out" | "fit") => void;
	done: () => void;
	startTool: ToolStarters;
	editSelected: () => void;
	deleteSelected: () => void;
	deselect: () => void;
	duplicate: () => void;
	arrange: (move: ArrangeMove) => void;
	nudge: (dx: number, dy: number) => void;
	stepBrush: (step: 1 | -1) => void;
}) {
	const handleShortcut = (shortcut: Shortcut): boolean => {
		const command = shortcutCommand(modeState, selection, shortcut, specs);
		if (command === null) return false;
		if (command !== "held") runShortcut(command);
		return true;
	};
	const runShortcut = (command: ShortcutCommand) => {
		switch (command.type) {
			case "openShortcuts":
			case "closeShortcuts":
			case "closeStickers":
			case "stopEyedropper":
				dispatchMode({ type: command.type });
				break;
			case "undo":
				undo();
				break;
			case "redo":
				redo();
				break;
			case "export":
				openExport();
				break;
			case "zoom":
				zoom(command.to);
				break;
			case "doneWithTool":
				done();
				break;
			case "tool":
				startTool[command.tool]();
				break;
			case "layers":
				dispatchMode({ type: "toggleLayers" });
				break;
			case "edit":
				editSelected();
				break;
			case "delete":
				deleteSelected();
				break;
			case "deselect":
				deselect();
				break;
			case "duplicate":
				duplicate();
				break;
			case "reorder":
				arrange(command.step === 1 ? "forward" : "backward");
				break;
			case "nudge":
				nudge(command.dx, command.dy);
				break;
			case "brushSize":
				stepBrush(command.step);
				break;
			default:
				assertNever(command);
		}
	};
	const onShortcut = useEffectEvent(handleShortcut);
	useEffect(() => {
		if (Platform.OS !== "web" || !enabled) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.isComposing || isEditable(event.target)) return;
			const shortcut = shortcutFor(event, toolsByKey);
			if (!shortcut) return;
			// Enter on a focused button presses it.
			if (shortcut.type === "edit" && event.target !== window.document.body) {
				return;
			}
			if (onShortcut(shortcut) || event.metaKey || event.ctrlKey) {
				event.preventDefault();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enabled, toolsByKey]);
}

function isEditable(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT")
	);
}
