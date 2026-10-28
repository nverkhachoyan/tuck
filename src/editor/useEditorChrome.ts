import type { Layer } from "@/model/layers/layer";
import type { ToolControllers } from "./defineTool";
import { modeChrome } from "./editorChrome";
import { layerKindName } from "./layers/LayerRow";
import type { ModeActionProps } from "./shell/Dock";
import { useStore } from "./store";
import type { TextController } from "./text/useTextEditing";
import type { ToolId, ToolSpecs } from "./toolSpec";

/**
 * The dock's panel, and its title, Cancel, and Done (`modeActions`), chosen
 * once for both layouts (see `modeChrome`): for the open tool, the text
 * being typed or styled, or the selected layer. On a wide screen the panel
 * sits in the header's context bar (`inBar`).
 */
export function useEditorChrome({
	specs,
	tool,
	controllers,
	text,
	selectedLayer,
	wide,
	done,
	cancel,
}: {
	specs: ToolSpecs;
	tool: ToolId | null;
	controllers: ToolControllers;
	text: TextController;
	selectedLayer: Layer | undefined;
	wide: boolean;
	done: () => void;
	cancel: () => void;
}) {
	const { selectLayer } = useStore((state) => state.actions);
	const open = tool && controllers[tool];
	const chrome = modeChrome({
		specs,
		tool,
		editingText: text.edit !== null,
		styledText: text.styledText !== undefined,
		layerName: selectedLayer ? layerKindName(selectedLayer) : null,
		toolDoneLabel: open
			? open.definition.doneLabel?.(open.controller)
			: undefined,
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
