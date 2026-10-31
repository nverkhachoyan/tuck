import {
	createRef,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Platform, StyleSheet, View, type ViewInstance } from "react-native";
import { usePreference } from "@/platform/usePreference";
import { Announcement } from "@/ui/Announcement";
import { CanvasStage } from "@/ui/CanvasStage";
import { isHexColor } from "@/ui/color";
import { DropOverlay } from "@/ui/DropOverlay";
import { Toast } from "@/ui/Toast";
import { space } from "@/ui/theme";
import { BUILT_IN_TOOLBAR } from "./builtInSpecs";
import { BUILT_IN_TOOLS } from "./builtInTools";
import { definitionOf, type ToolList } from "./defineTool";
import type { EditorDocument } from "./document/document";
import { targetImageLayer, visibleImageLayer } from "./document/framing";
import type { Point } from "./document/geometry";
import { EditorCanvas, type EditorCanvasHandle } from "./EditorCanvas";
import { EditorHeader } from "./EditorHeader";
import { EditorInspector } from "./EditorInspector";
import { EditorRail } from "./EditorRail";
import type { SceneDraft } from "./EditorScene";
import { layerActionsFor, toolbarEntries } from "./editorChrome";
import { EditorContext, type EditorContextValue } from "./editorContext";
import type { EditorHost } from "./editorHost";
import { openTray, takesKeys } from "./editorMode";
import { LayerSelectionBar, useArrangeSelected } from "./LayerSelectionBar";
import { maxNewImageShortSide } from "./layers/image/image";
import {
	LAYERS_SIDEBAR_INSET,
	LayersPanel,
	layerListProps,
} from "./layers/panel/LayersPanel";
import {
	ContextBarContent,
	DockContent,
	type PanelContext,
	ToolCard,
	ToolSheet,
	ToolStage,
	ToolTrays,
} from "./PanelViews";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { EyedropperHint } from "./shell/ColorOptions";
import { Dock, DockFooter } from "./shell/Dock";
import { HeaderActions } from "./shell/HeaderActions";
import { SaveErrorBanner } from "./shell/SaveErrorBanner";
import { TrayHeight } from "./shell/ToolOptions";
import { ToolsPanel } from "./shell/ToolsPanel";
import type { ToolEntry } from "./shell/toolList";
import { shortcutGroups, toolsByKey } from "./shortcuts";
import { useStore } from "./store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
} from "./store/editorSlice";
import { useAddImage } from "./useAddImage";
import { useCanvasInput } from "./useCanvasInput";
import { useEditNotice } from "./useEditNotice";
import { useEditorChrome } from "./useEditorChrome";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorMode } from "./useEditorMode";
import { useEditorShortcuts, useToolKeys } from "./useEditorShortcuts";
import { useEditorTools } from "./useEditorTools";

const parseCustomColor = (saved: unknown) => (isHexColor(saved) ? saved : null);

/**
 * The editor for the session's document, in the app that `host` gives it.
 * - `document`: the session's document as the app sees it. The editor draws
 *   the store's own, which differs while a tool previews its changes (see
 *   `Session`).
 * - `host`: the app's side; its save problem shows in the header and over
 *   the canvas.
 * - `tools`: the tools it offers, by id, the built-in ones unless given
 *   others (see `editorTools`). Read once: the list must not change while
 *   it's mounted, since each tool's hook runs every render.
 * - `toolbar`: the order of the dock's and the rail's buttons, mixing tool
 *   ids and the editor's own entries.
 */
export function Editor({
	document: opened,
	host,
	tools = BUILT_IN_TOOLS,
	toolbar = BUILT_IN_TOOLBAR,
}: {
	document: EditorDocument;
	host: EditorHost;
	tools?: ToolList;
	toolbar?: readonly string[];
}) {
	const { focused, saveProblem } = host;
	const document = useStore((state) => state.document) ?? opened;
	const [toolbox] = useState(() => {
		const specs = Object.fromEntries(
			Object.entries(tools).map(([id, tool]) => [id, tool.spec]),
		);
		const entries = toolbarEntries(specs, toolbar);
		// Where each tool with a sheet opens it on a wide window: beside its
		// rail button.
		const sheetAnchors = Object.fromEntries(
			Object.entries(tools)
				.filter(([, tool]) => definitionOf(tool).views.Sheet)
				.map(([id]) => [id, createRef<ViewInstance>()]),
		);
		return {
			tools,
			specs,
			toolbar,
			entries,
			sheetAnchors,
			toolsByKey: toolsByKey(entries, specs),
			shortcutGroups: shortcutGroups(entries, specs),
		};
	});
	const { specs } = toolbox;
	const selectedLayer = useStore(selectSelectedLayer);
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const actions = useStore((state) => state.actions);
	const {
		addImageLayer,
		addStickerLayer,
		duplicateSelectedLayer,
		transformLayer,
		resizeBox,
		nudgeLayer,
		setLayerResizable,
		selectLayer,
		undo,
		redo,
	} = actions;

	const canvasRef = useRef<EditorCanvasHandle>(null);
	const rootRef = useRef<ViewInstance>(null);

	// What the editor is doing, and what's open over it. A tool puts itself
	// down if its image goes away, or its photo does.
	const targetImage = targetImageLayer(document, selectedLayer);
	const [modeState, dispatchMode] = useEditorMode(
		{
			isAdjustable: (id) => visibleImageLayer(document, id) !== undefined,
			hasPhoto: targetImage !== null,
		},
		specs,
	);
	const { mode, eyedropper } = modeState;
	// The tool in the dock. While drawing, strokes on the canvas go into the
	// selected drawing, or a new one; while redacting, into the selected
	// brushed redaction, or a new one. While finding, taps on the canvas pick
	// what's found. While adjusting, the canvas holds still. While cutting
	// out, taps pick a subject, or strokes paint the cut. A tap away from what
	// the tool works on puts it down, as Done does.
	const tool = mode.type === "tool" ? mode.tool : null;
	// A tool that keeps a draft until Done takes the keys: Export would leave
	// the draft out, and an edit to the layers would change the document
	// under it.
	const draftOpen = takesKeys(mode, specs);
	const layersOpen = modeState.sheet === "layers";

	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);

	const {
		busy: addBusy,
		dragging,
		pick: addPhoto,
		addLayerImage,
	} = useAddImage({
		host,
		// On web, an image pasted or dropped onto the editor joins the canvas,
		// unless another screen or tool is in front of it.
		enabled: focused && !draftOpen,
		maxShortSide: maxNewImageShortSide(document),
		onImage: async ({ uri, width, height, opaque }, kind) => {
			const url = await host.addImage(uri, opaque);
			const area = canvasRef.current?.visibleArea();
			const add = kind === "sticker" ? addStickerLayer : addImageLayer;
			add(url, width, height, opaque, area);
		},
	});

	const editNotice = useEditNotice(document);

	// Stable, so the sheets' swipes aren't rebuilt on every render.
	const closeLayers = useCallback(
		() => dispatchMode({ type: "closeLayers" }),
		[dispatchMode],
	);

	const {
		controllers,
		startTool,
		busy: busyTools,
		editLayer,
		editorOf,
		stylerOf,
		done,
		cancel,
		finishTool,
		stepToolSize,
		resetEdit,
		announcements,
	} = useEditorTools({
		tools: toolbox.tools,
		document,
		mode,
		dispatchMode,
		targetImage,
		documentSize,
		host,
		addLayerImage,
		addPhoto,
		view: {
			zoomToArea: (area) => canvasRef.current?.zoomToArea(area),
			fit: () => canvasRef.current?.zoom("fit"),
			visibleArea: () => canvasRef.current?.visibleArea(),
		},
		notify: editNotice.notify,
	});

	const openTool = tool ? controllers[tool] : undefined;
	// The tool that edits the selected layer in place, or styles it while
	// nothing is open.
	const selectedStyler = (selectedLayer && stylerOf(selectedLayer)) ?? null;
	const selectedEditor = (selectedLayer && editorOf(selectedLayer)) ?? null;
	const ToolInput = openTool?.definition.views.Input;
	const typing = tool !== null && specs[tool]?.takesKeys === "typing";
	const layout = useEditorLayout({
		typing,
		layersOpen,
		cardOpen: openTool?.definition.views.Card !== undefined,
	});
	const { wide, layersBeside, dockInset, inspector, inspectorPinned } = layout;
	const toolOptionsOpen = openTray(mode) !== null;
	// The last color picked from a color picker, which every custom swatch
	// keeps while a preset is in use. Null until there's one. Like the tools'
	// settings, it's kept between sessions.
	const [customColor, setCustomColor] = usePreference(
		"customColor",
		parseCustomColor,
	);

	const canvasInput = useCanvasInput({
		document,
		tool,
		controllers,
		eyedropper,
		dispatchMode,
		onCustomColor: setCustomColor,
	});

	// On web, inert takes the editor out of the tab order and accessibility
	// tree under the export sheet.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const root = rootRef.current as unknown as HTMLElement | null;
		root?.toggleAttribute("inert", !focused);
	}, [focused]);

	const selectedPlace = useArrangeSelected(document, selectedLayer);

	// Back puts the open tool down as Done does.
	const leave = () => {
		finishTool();
		host.leave();
	};

	const { panel, inBar, modeActions } = useEditorChrome({
		specs,
		tool,
		controllers,
		selectedLayer,
		stylingTool: selectedStyler,
		wide,
		done,
		cancel,
		onReset: resetEdit,
	});

	useEditorShortcuts({
		specs,
		toolsByKey: toolbox.toolsByKey,
		enabled: focused && !draftOpen,
		modeState,
		selection: selectedEditor ? "editable" : selectedLayer ? "layer" : null,
		dispatchMode,
		undo,
		redo,
		openExport: host.openExport,
		zoom: (to) => canvasRef.current?.zoom(to),
		done,
		cancel,
		startTool,
		editSelected: () => {
			if (selectedLayer) editLayer(selectedLayer);
		},
		deleteSelected: () => {
			if (selectedLayer) editNotice.deleteLayer(selectedLayer.id);
		},
		deselect: () => selectLayer(null),
		duplicate: duplicateSelectedLayer,
		arrange: selectedPlace.arrange,
		nudge: (dx, dy) => canvasRef.current?.nudgeSelection(dx, dy),
		stepBrush: stepToolSize,
	});
	useToolKeys({ enabled: focused && draftOpen, typing, done, cancel });

	const layerList = layerListProps({
		document,
		selectedLayer,
		actions: {
			...actions,
			deleteLayer: editNotice.deleteLayer,
			deleteLayerGroup: editNotice.deleteGroup,
		},
		onClose: closeLayers,
		bottomInset: dockInset,
	});
	// The sidebar stops above the dock, which stays usable.
	const layersPanel = (
		<LayersPanel
			{...layerList}
			layout={layersBeside ? "sidebar" : "sheet"}
			open={layersOpen}
			inert={draftOpen}
		/>
	);

	const hasImage = targetImage !== null;
	const [cutVariant, setCutVariant] = useState<"cut" | "removeBg">("cut");
	// The buttons that spin: Add photo while a photo is on its way, and the
	// tools whose work is running.
	const busy = addBusy ? [...busyTools, "photo"] : busyTools;

	const toolStarters = useMemo(
		() => ({
			...startTool,
			cut: () => {
				if (cutVariant === "removeBg") {
					startTool.removeBg();
				} else {
					startTool.cut();
				}
			},
		}),
		[startTool, cutVariant],
	);

	// Tools entries on the rail and dock, updated with each tool's active
	// variant and flyout choices.
	const toolEntries = useMemo(() => {
		return toolbox.entries.map((entry): ToolEntry => {
			if (entry.id === "cut") {
				const isRemoveBg =
					tool === "removeBg" || (tool !== "cut" && cutVariant === "removeBg");
				return {
					...entry,
					label: isRemoveBg ? "Remove BG" : "Cut",
					icon: isRemoveBg ? "auto-fix" : "scissors-cutting",
					activeVariant: isRemoveBg ? "removeBg" : "cut",
					variants: [
						{
							id: "cut",
							label: "Cutout",
							icon: "scissors-cutting",
							shortcut: "B",
						},
						{
							id: "removeBg",
							label: "Remove BG",
							icon: "auto-fix",
							shortcut: "G",
						},
					],
					onSelectVariant: (variantId) => {
						setCutVariant(variantId as "cut" | "removeBg");
						if (variantId === "removeBg") {
							if (tool) finishTool();
							startTool.removeBg();
							return;
						}
						if (tool && tool !== "cut") finishTool();
						startTool.cut();
					},
				};
			}
			const openTool = controllers[entry.id];
			const toolDef = openTool?.definition;
			if (toolDef?.variants) {
				const variants = toolDef.variants(openTool.controller);
				const active = toolDef.activeVariant?.(openTool.controller);
				const custom = toolDef.variantEntry?.(openTool.controller);
				return {
					...entry,
					label: custom?.label ?? entry.label,
					icon: custom?.icon ?? entry.icon,
					activeVariant: active,
					variants,
					onSelectVariant: (variantId) => {
						if (tool && tool !== entry.id) finishTool();
						toolDef.selectVariant?.(openTool.controller, variantId);
						startTool[entry.id]?.();
					},
				};
			}
			return entry;
		});
	}, [toolbox.entries, controllers, tool, cutVariant, finishTool, startTool]);

	// What the dock offers for the selected layer: the tools that act on it,
	// and the buttons tools add for it, each in the toolbar's order.
	const layerTools =
		selectedLayer && layerActionsFor(selectedLayer, specs, toolbox.toolbar);
	const layerActions = layerTools && {
		tools: toolEntries.filter((entry) => layerTools.includes(entry.id)),
		busy,
		startTool: toolStarters,
		actions: toolbox.toolbar.flatMap((id) => {
			const listed = controllers[id];
			const action = listed?.definition.layerAction?.(
				listed.controller,
				selectedLayer,
			);
			return action ? [action] : [];
		}),
	};

	// What every tool's views read from the editor around them, and what the
	// dock, the bar, the trays, and the inspector read besides.
	const rightInset =
		layersBeside && !wide && layersOpen ? LAYERS_SIDEBAR_INSET : 0;
	const editorContext: EditorContextValue = {
		customColor,
		setCustomColor,
		startEyedropper: (apply) =>
			dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
		trayOpen: toolOptionsOpen,
		toggleTray: () => dispatchMode({ type: "toggleToolOptions" }),
		closeTray: () => dispatchMode({ type: "closeToolOptions" }),
		bottomInset: dockInset,
		rightInset,
		wide,
		cancel,
	};
	const panels: PanelContext = {
		controllers,
		layerActions: layerActions || undefined,
	};

	// A tap on a selected layer a tool edits in place edits it there, from
	// where the tap landed.
	const editable = selectedEditor !== null && selectedLayer;
	const editSelectedAt =
		editable && ((point: Point) => editLayer(editable, point));

	// The layer the open tool edits in place, drawn by its `Draft` view.
	const openDraft = openTool?.definition.draft?.(openTool.controller);
	const DraftView = openTool?.definition.views.Draft;
	const draft: SceneDraft | null =
		openTool && openDraft && DraftView
			? {
					...openDraft,
					render: (viewScale) => (
						<DraftView controller={openTool.controller} viewScale={viewScale} />
					),
				}
			: null;

	const selectionBar = selectedLayer && (
		<LayerSelectionBar
			layer={selectedLayer}
			index={selectedPlace.index}
			topIndex={selectedPlace.topIndex}
			onEdit={editable ? () => editLayer(editable) : undefined}
			onSetResizable={setLayerResizable}
			onArrange={selectedPlace.arrange}
			onDuplicate={duplicateSelectedLayer}
			onDelete={editNotice.deleteLayer}
		/>
	);

	return (
		<TrayHeight.Provider value={layout.setTrayHeight}>
			<EditorContext.Provider value={editorContext}>
				<View ref={rootRef} style={styles.container}>
					<EditorHeader
						wide={wide}
						title={host.title}
						saved={!saveProblem}
						onBack={leave}
						bar={
							inBar && modeActions ? (
								<ContextBarContent
									context={panels}
									panel={panel}
									chrome={modeActions}
									keepFocus={typing}
								/>
							) : undefined
						}
					>
						<HeaderActions
							// A tall window's inspector already shows the layers.
							layers={
								!inspectorPinned && (!tool || layersBeside)
									? {
											open: layersOpen,
											onToggle: () => dispatchMode({ type: "toggleLayers" }),
										}
									: undefined
							}
							canUndo={canUndo}
							canRedo={canRedo}
							onUndo={undo}
							onRedo={redo}
							onShortcuts={() => dispatchMode({ type: "openShortcuts" })}
							onExport={draftOpen ? undefined : host.openExport}
						/>
					</EditorHeader>
					{/* The dock covers the stage's bottom, which runs under it. On a
					    wide screen the rail and inspector rest on it as cards. */}
					<CanvasStage ref={layout.stageRef} toBottom frameless={wide}>
						<EditorCanvas
							ref={canvasRef}
							document={document}
							selectedLayer={selectedLayer}
							draft={draft}
							keepFocus={typing}
							onSelectLayer={selectLayer}
							onTapSelectedLayer={editSelectedAt || undefined}
							onCommitTransform={transformLayer}
							onResizeBox={resizeBox}
							onNudgeLayer={nudgeLayer}
							{...canvasInput}
							onToolInteractionEnd={() =>
								dispatchMode({ type: "closeToolOptions" })
							}
							onTapAway={done}
							bottomInset={layout.canvasInset.bottom}
							leftInset={layout.canvasInset.left}
							rightInset={layout.canvasInset.right}
							selectionBar={selectionBar}
						/>
						{openTool?.definition.views.Stage && (
							<ToolStage tool={openTool} inset={layout.canvasInset} />
						)}
						{!wide && (
							<ToolTrays context={panels} modeState={modeState} panel={panel} />
						)}
						{wide && openTool?.definition.views.Card && (
							<ToolCard tool={openTool} inset={layout.canvasInset} />
						)}
						{eyedropper && (
							<EyedropperHint
								onCancel={() => dispatchMode({ type: "stopEyedropper" })}
							/>
						)}
						{announcements.map(([id, message]) => (
							<Announcement key={id} message={message} />
						))}
						{saveProblem && (
							<SaveErrorBanner
								message={saveProblem}
								onRetry={host.retrySave}
								rightInset={layout.coveredRight}
							/>
						)}
						{layersBeside && !wide && layersPanel}
						{wide && (
							<EditorRail
								tools={toolEntries}
								chosen={tool}
								busy={busy}
								hasImage={hasImage}
								startTool={toolStarters}
								tool={tool}
								finishTool={finishTool}
								sheetAnchors={toolbox.sheetAnchors}
							/>
						)}

						{/* Rendered after ToolTrays so taps on the dock reach it rather
						    than dismissing an open tray. */}
						{inspector ? (
							<EditorInspector layerList={layerList} layersInert={draftOpen} />
						) : !wide ? (
							<Dock
								panel={panel}
								footer={
									modeActions ? <DockFooter {...modeActions} /> : undefined
								}
								keyboardOverlap={layout.keyboardOverlap}
								rightInset={rightInset}
							>
								<DockContent
									context={panels}
									panel={panel}
									idle={
										<ToolsPanel
											tools={toolEntries}
											busy={busy}
											hasImage={hasImage}
											startTool={toolStarters}
										/>
									}
								/>
							</Dock>
						) : null}
					</CanvasStage>
					{!layersBeside && layersPanel}
					{editNotice.message && (
						<Toast
							message={editNotice.message}
							action="Undo"
							onAction={editNotice.undo}
							secondAction={editNotice.action}
							inset={{
								left: layout.canvasInset.left,
								right: layout.coveredRight ?? 0,
								bottom: layout.coveredBottom + space.md,
							}}
						/>
					)}
					{Object.entries(toolbox.sheetAnchors).map(([id, anchor]) => (
						<ToolSheet
							key={id}
							tool={controllers[id]}
							open={tool === id}
							anchor={wide ? anchor : undefined}
							onClose={finishTool}
						/>
					))}

					{dragging && <DropOverlay label="Drop to add to the canvas" />}
					{typing && openTool && ToolInput && (
						<ToolInput controller={openTool.controller} />
					)}
					{modeState.shortcutsOpen && (
						<ShortcutsOverlay
							groups={toolbox.shortcutGroups}
							onClose={() => dispatchMode({ type: "closeShortcuts" })}
						/>
					)}
				</View>
			</EditorContext.Provider>
		</TrayHeight.Provider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
