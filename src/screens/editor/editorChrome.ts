// What the editor's chrome shows for the mode: which panel the dock or the
// context bar holds, its title, and what its Cancel and Done do. Plain
// TypeScript, so the phone and wide layouts are tested to agree; the screen
// turns the actions into handlers once and gives both layouts the result.

import type { EditorTool } from "./editorMode.ts";
import { type MarkedTool, toolLabel } from "./shell/toolList.ts";

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
export type DockPanel = EditorTool | "text" | "layer" | "idle";

// What Cancel and Done apply to: the open tool, the text being typed, or the
// selection, which Done lets go of.
export type ChromeCancel = "tool" | "text";
export type ChromeDone = "tool" | "text" | "deselect";

export type ChromeActions = {
	title: string;
	// Absent when there's nothing to take back, as with a selected layer.
	cancel?: ChromeCancel;
	done: ChromeDone;
	// What Done does, when it's more than finishing.
	doneLabel?: string;
};

export type ModeChrome = {
	panel: DockPanel;
	// The title and actions for the dock's footer or the context bar, for the
	// open tool, the text being typed or styled, or the selected layer.
	// Nothing in context has none.
	actions: ChromeActions | null;
	// Whether the panel sits in the wide header's context bar, in place of
	// the project's title.
	inBar: boolean;
};

export type ModeChromeInput = {
	tool: EditorTool | null;
	editingText: boolean;
	styledText: boolean;
	layerName: string | null;
	findChosen: number;
	wide: boolean;
};

/**
 * The editor's chrome for the mode, the same for the dock and the bar.
 * - `tool`: the open tool, which comes first. Its Cancel and Done are the
 *   tool's, and Find's Done names how many regions it redacts.
 * - `editingText`: text being typed, whose Cancel and Done are the text's.
 * - `styledText`: text styled but not typed (a selected text layer), which
 *   shows text's panel with no Cancel, and Done lets go of it.
 * - `layerName`: the selected layer's name (`layerKindName`), for its title.
 *   Done lets go of it, and there's no Cancel.
 * - `findChosen`: how many of Find's regions are chosen.
 * - `wide`: a wide window, where every panel but `"idle"` is in the bar.
 */
export function modeChrome({
	tool,
	editingText,
	styledText,
	layerName,
	findChosen,
	wide,
}: ModeChromeInput): ModeChrome {
	const chrome = (
		panel: DockPanel,
		actions: ChromeActions | null,
	): ModeChrome => ({ panel, actions, inBar: wide && panel !== "idle" });

	if (tool) {
		return chrome(tool, {
			title: toolLabel(tool),
			cancel: "tool",
			done: "tool",
			doneLabel:
				tool === "find" && findChosen > 0
					? `Redact ${findChosen} chosen`
					: undefined,
		});
	}
	if (editingText) {
		return chrome("text", { title: "Text", cancel: "text", done: "text" });
	}
	if (styledText) {
		return chrome("text", { title: "Text", done: "deselect" });
	}
	if (layerName !== null) {
		return chrome("layer", { title: layerName, done: "deselect" });
	}
	return chrome("idle", null);
}

export type RailChosenToolInput = {
	tool: EditorTool | null;
	editingText: boolean;
	cropping: boolean;
	stickersOpen: boolean;
};

/**
 * Which tool the wide rail highlights as chosen:
 * - `editingText`: text being typed, which marks Text.
 * - `cropping`: the crop screen, which marks Crop.
 * - `stickersOpen`: the sticker popover, which marks Sticker.
 * - `tool`: the open tool (Find marks Redact through its entry).
 * When none is active, no tool is marked.
 */
export function railChosenTool({
	tool,
	editingText,
	cropping,
	stickersOpen,
}: RailChosenToolInput): MarkedTool | null {
	if (editingText) return "text";
	if (cropping) return "crop";
	if (stickersOpen) return "sticker";
	return tool;
}
