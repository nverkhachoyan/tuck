import { useCallback, useMemo } from "react";
import type { Layer } from "../layers/layer";
import type { ModeActionProps } from "../shell/modeActions";
import type { ToolEntry, ToolStarters } from "../shell/toolList";
import { useStore } from "../store";
import type { ToolControllers } from "../tools/defineTool";
import { escapeCancels, type ToolId, type ToolSpecs } from "../tools/toolSpec";
import { layerActionsFor, modeChrome, toolbarEntries } from "./editorChrome";
import { layerKindName } from "./layersPanel/LayerRow";

/**
 * The dock's panel, and its title, Cancel, and Done (`modeActions`), chosen
 * once for both layouts (see `modeChrome`): for the open tool, or the
 * selected layer and the tool styling it (`stylingTool`). On a wide screen
 * the panel sits in the header's context bar (`inBar`).
 *
 * Also derives the toolbar entries with variants and busy states, the tool
 * starters mapped to active variants, and the layer actions for the selected
 * layer.
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
	onReset,
	toolbox,
	busyTools,
	addBusy,
	putDownTool,
	startTool,
	layerStarters,
	isToolAvailable: isAvailableProp,
}: {
	specs: ToolSpecs;
	tool: ToolId | null;
	controllers: ToolControllers;
	selectedLayer: Layer | undefined;
	stylingTool: ToolId | null;
	wide: boolean;
	done: () => void;
	cancel: () => void;
	onReset?: () => void;
	toolbox: { entries: ToolEntry[]; toolbar: readonly string[] };
	busyTools: readonly string[];
	addBusy: boolean;
	putDownTool: () => void;
	startTool: ToolStarters;
	layerStarters: ToolStarters;
	isToolAvailable?: (id: string) => boolean;
}) {
	const { selectLayer } = useStore((state) => state.actions);
	const open = tool && controllers[tool];
	const toolDoneLabel = open
		? open.definition.doneLabel
			? open.definition.doneLabel(open.controller)
			: undefined
		: undefined;
	const toolDoneVariant = open
		? open.definition.doneVariant?.(open.controller)
		: undefined;
	const chrome = modeChrome({
		specs,
		tool,
		stylingTool,
		layerName: selectedLayer ? layerKindName(selectedLayer) : null,
		toolDoneLabel,
		toolDoneVariant,
		wide,
	});
	const onDone = { tool: done, deselect: () => selectLayer(null) };
	const isDeselect = chrome.actions?.done === "deselect";
	const doneKey =
		tool && specs[tool]?.takesKeys === "typing" ? "mod+Enter" : "Enter";
	const modeActions: ({ title: string } & ModeActionProps) | null =
		chrome.actions && {
			title: chrome.actions.title,
			onReset,
			onCancel: chrome.actions.cancel ? cancel : undefined,
			cancelShortcut:
				chrome.actions.cancel && tool !== null && escapeCancels(specs[tool])
					? "Escape"
					: undefined,
			onDone: chrome.actions.done ? onDone[chrome.actions.done] : undefined,
			doneLabel: isDeselect ? "Deselect" : chrome.actions.doneLabel,
			doneShortcut: !chrome.actions.done
				? undefined
				: isDeselect
					? "Escape"
					: doneKey,
			doneVariant: chrome.actions.doneVariant,
		};

	const defaultIsToolAvailable = useCallback(
		(id: string) => {
			const openTool = controllers[id];
			return openTool?.definition.available?.(openTool.controller) ?? true;
		},
		[controllers],
	);
	const isToolAvailable = isAvailableProp ?? defaultIsToolAvailable;

	// Tools entries on the rail and dock, updated with each tool's active
	// variant and flyout choices.
	const toolEntries = useMemo(() => {
		return toolbox.entries.map((entry): ToolEntry => {
			const openTool = controllers[entry.id];
			const toolDef = openTool?.definition;
			if (!toolDef?.variants) return entry;
			const variants = toolDef
				.variants(openTool.controller)
				?.filter((v) => !v.tool || (specs[v.tool] && isToolAvailable(v.tool)));
			if (!variants || variants.length <= 1) return entry;
			const activeId =
				variants.find((v) => v.tool && v.tool === tool)?.id ??
				toolDef.activeVariant?.(openTool.controller);
			const active = variants.find((v) => v.id === activeId) ?? variants[0];
			const custom = toolDef.variantEntry?.(openTool.controller);
			const targetSpec = active.tool ? specs[active.tool] : undefined;
			return {
				...entry,
				label: custom?.label ?? targetSpec?.label ?? entry.label,
				icon: custom?.icon ?? targetSpec?.icon ?? entry.icon,
				key: targetSpec?.key ?? entry.key,
				activeVariant: active.id,
				variants,
				onSelectVariant: (variantId) => {
					const chosen = variants.find((v) => v.id === variantId);
					const target = chosen?.tool ?? entry.id;
					if (tool && tool !== target) putDownTool();
					toolDef.selectVariant?.(openTool.controller, variantId);
					startTool[target]?.();
				},
			};
		});
	}, [
		toolbox.entries,
		specs,
		controllers,
		tool,
		putDownTool,
		startTool,
		isToolAvailable,
	]);

	// The buttons that spin: Add photo while a photo is on its way, and the
	// tools whose work is running (including a variant's tool).
	const busy = useMemo(() => {
		const ids = [...busyTools];
		if (addBusy) ids.push("photo");
		for (const entry of toolEntries) {
			if (
				!ids.includes(entry.id) &&
				entry.variants?.some((v) => v.tool && busyTools.includes(v.tool))
			) {
				ids.push(entry.id);
			}
		}
		return ids;
	}, [busyTools, addBusy, toolEntries]);

	const toolStarters = useMemo(
		() =>
			Object.fromEntries(
				toolEntries.map((entry) => {
					const active = entry.variants?.find(
						(v) => v.id === entry.activeVariant,
					);
					const target = active?.tool ?? entry.id;
					return [entry.id, () => startTool[target]?.()];
				}),
			),
		[toolEntries, startTool],
	);

	// What the dock offers for the selected layer: the tools that act on it,
	// and the buttons tools add for it, each in the toolbar's order.
	const layerTools =
		selectedLayer &&
		layerActionsFor(selectedLayer, specs, toolbox.toolbar, isToolAvailable);
	const layerActions = layerTools
		? {
				tools: toolbarEntries(specs, layerTools, isToolAvailable),
				busy: busyTools,
				// Opened from the layer, a tool keeps to it and keeps it selected.
				startTool: layerStarters,
				actions: toolbox.toolbar.flatMap((id) => {
					const listed = controllers[id];
					const action = listed?.definition.layerAction?.(
						listed.controller,
						selectedLayer,
					);
					return action ? [action] : [];
				}),
			}
		: undefined;

	return {
		panel: chrome.panel,
		inBar: chrome.inBar,
		modeActions,
		toolEntries,
		busy,
		toolStarters,
		layerActions,
	};
}
