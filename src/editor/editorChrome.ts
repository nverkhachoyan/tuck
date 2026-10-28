// What the editor's chrome shows: the tools' buttons, which panel the dock
// or the context bar holds for the mode, its title, and what its Cancel and
// Done do. Plain TypeScript, so the phone and wide layouts are tested to
// agree; the screen turns the actions into handlers once and gives both
// layouts the result.

import type { Layer } from "../model/layers/layer.ts";
import { isOwnTool, TOOLS, type ToolEntry } from "./shell/toolList.ts";
import { TOOL_KEYS } from "./shortcuts.ts";
import type { ToolId, ToolSpecs } from "./toolSpec.ts";

/**
 * The buttons for `toolbar`'s tools and entries, in its order: a tool's
 * from its spec in `specs`, and an entry's from `TOOLS`.
 */
export function toolbarEntries(
	specs: ToolSpecs,
	toolbar: readonly string[],
): ToolEntry[] {
	return toolbar.map((id) => {
		if (isOwnTool(id)) {
			return { id, ...TOOLS[id], key: TOOL_KEYS[id], needsImage: false };
		}
		const { label, icon, key, shortcut, target } = specs[id];
		return { id, label, icon, key, shortcut, needsImage: target !== "none" };
	});
}

/**
 * The tools a selected `layer` offers in place of the toolbar: those in
 * `toolbar` whose spec acts on it, in its order.
 */
export function layerActionsFor(
	layer: Layer,
	specs: ToolSpecs,
	toolbar: readonly string[],
): ToolId[] {
	return toolbar.filter((id) => specs[id]?.actsOn(layer));
}

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
export type DockPanel = ToolId | "text" | "layer" | "idle";

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
	specs: ToolSpecs;
	tool: ToolId | null;
	editingText: boolean;
	styledText: boolean;
	layerName: string | null;
	toolDoneLabel: string | undefined;
	wide: boolean;
};

/**
 * The editor's chrome for the mode, the same for the dock and the bar.
 * - `tool`: the open tool, which comes first. Its title is its spec's label
 *   in `specs`, its Cancel and Done are the tool's, and Done says
 *   `toolDoneLabel` when the tool gives one.
 * - `editingText`: text being typed, whose Cancel and Done are the text's.
 * - `styledText`: text styled but not typed (a selected text layer), which
 *   shows text's panel with no Cancel, and Done lets go of it.
 * - `layerName`: the selected layer's name (`layerKindName`), for its title.
 *   Done lets go of it, and there's no Cancel.
 * - `wide`: a wide window, where every panel but `"idle"` is in the bar.
 */
export function modeChrome({
	specs,
	tool,
	editingText,
	styledText,
	layerName,
	toolDoneLabel,
	wide,
}: ModeChromeInput): ModeChrome {
	const chrome = (
		panel: DockPanel,
		actions: ChromeActions | null,
	): ModeChrome => ({ panel, actions, inBar: wide && panel !== "idle" });

	if (tool) {
		return chrome(tool, {
			title: specs[tool]?.label ?? tool,
			cancel: "tool",
			done: "tool",
			doneLabel: toolDoneLabel,
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
	tool: ToolId | null;
	editingText: boolean;
	cropping: boolean;
	stickersOpen: boolean;
};

/**
 * Which tool the wide rail highlights as chosen:
 * - `editingText`: text being typed, which marks Text.
 * - `cropping`: the crop screen, which marks Crop.
 * - `stickersOpen`: the sticker popover, which marks Sticker.
 * - `tool`: the open tool.
 * When none is active, no tool is marked.
 */
export function railChosenTool({
	tool,
	editingText,
	cropping,
	stickersOpen,
}: RailChosenToolInput): string | null {
	if (editingText) return "text";
	if (cropping) return "crop";
	if (stickersOpen) return "sticker";
	return tool;
}
