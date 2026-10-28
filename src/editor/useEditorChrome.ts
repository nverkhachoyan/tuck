import type { Layer } from "@/model/layers/layer";
import { useStore } from "@/store";
import { modeChrome } from "./editorChrome";
import type { EditorTool } from "./editorMode";
import { layerKindName } from "./layers/LayerRow";
import type { ModeActionProps } from "./shell/Dock";
import { toolDoneLabel } from "./toolDefinitions";
import type { EditorTools } from "./useEditorTools";

/**
 * The dock's panel, and its title, Cancel, and Done (`modeActions`), chosen
 * once for both layouts (see `modeChrome`): for the open tool, the text
 * being typed or styled, or the selected layer. On a wide screen the panel
 * sits in the header's context bar (`inBar`).
 */
export function useEditorChrome({
	tool,
	tools,
	selectedLayer,
	wide,
	done,
	cancel,
}: {
	tool: EditorTool | null;
	tools: EditorTools;
	selectedLayer: Layer | undefined;
	wide: boolean;
	done: () => void;
	cancel: () => void;
}) {
	const { selectLayer } = useStore((state) => state.actions);
	const { text } = tools;
	const chrome = modeChrome({
		tool,
		editingText: text.edit !== null,
		styledText: text.styledText !== undefined,
		layerName: selectedLayer ? layerKindName(selectedLayer) : null,
		toolDoneLabel: tool ? toolDoneLabel(tool, tools) : undefined,
		wide,
	});
	const onCancel = { tool: cancel, text: text.cancel };
	const onDone = {
		tool: done,
		text: text.finish,
		deselect: () => selectLayer(null),
	};
	const modeActions: ({ title: string } & ModeActionProps) | null =
		chrome.actions && {
			title: chrome.actions.title,
			onCancel: chrome.actions.cancel && onCancel[chrome.actions.cancel],
			onDone: onDone[chrome.actions.done],
			doneLabel: chrome.actions.doneLabel,
			doneShortcut: "Escape",
		};
	return { panel: chrome.panel, inBar: chrome.inBar, modeActions };
}
