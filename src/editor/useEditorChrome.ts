import type { ToolControllers } from "./defineTool";
import { modeChrome } from "./editorChrome";
import type { Layer } from "./layers/layer";
import { layerKindName } from "./layers/panel/LayerRow";
import type { ModeActionProps } from "./shell/Dock";
import { useStore } from "./store";
import type { ToolId, ToolSpecs } from "./toolSpec";

/**
 * The dock's panel, and its title, Cancel, and Done (`modeActions`), chosen
 * once for both layouts (see `modeChrome`): for the open tool, or the
 * selected layer and the tool styling it (`stylingTool`). On a wide screen
 * the panel sits in the header's context bar (`inBar`).
 */
export function useEditorChrome({
	specs,
	tool,
	controllers,
	selectedLayer,
	stylingTool,
	wide,
	done,
	cancel,
}: {
	specs: ToolSpecs;
	tool: ToolId | null;
	controllers: ToolControllers;
	selectedLayer: Layer | undefined;
	stylingTool: ToolId | null;
	wide: boolean;
	done: () => void;
	cancel: () => void;
}) {
	const { selectLayer } = useStore((state) => state.actions);
	const open = tool && controllers[tool];
	const chrome = modeChrome({
		specs,
		tool,
		stylingTool,
		layerName: selectedLayer ? layerKindName(selectedLayer) : null,
		toolDoneLabel: open
			? open.definition.doneLabel?.(open.controller)
			: undefined,
		wide,
	});
	const onDone = { tool: done, deselect: () => selectLayer(null) };
	const modeActions: ({ title: string } & ModeActionProps) | null =
		chrome.actions && {
			title: chrome.actions.title,
			onCancel: chrome.actions.cancel && cancel,
			onDone: onDone[chrome.actions.done],
			doneLabel: chrome.actions.doneLabel,
			doneShortcut: "Escape",
		};
	return { panel: chrome.panel, inBar: chrome.inBar, modeActions };
}
