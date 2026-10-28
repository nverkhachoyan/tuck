import { useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { neutralAdjustments } from "@/model/adjustments";
import { isHexColor } from "@/model/color";
import type { EditorDocument } from "@/model/document";
import { targetImageLayer, visibleImageLayer } from "@/model/framing";
import { type Point, toLayerSpace } from "@/model/geometry";
import { maxNewImageShortSide } from "@/model/layers/image";
import { usePreference } from "@/platform/usePreference";
import { exportHref } from "@/projects/projectRoute";
import { addImage } from "@/projects/projectService";
import { textIndexAt } from "@/render/textLayerLayout";
import { Announcement } from "@/ui/Announcement";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { Toast } from "@/ui/Toast";
import { space } from "@/ui/theme";
import { CropTool } from "./crop/CropTool";
import { EditorCanvas, type EditorCanvasHandle } from "./EditorCanvas";
import { EditorHeader } from "./EditorHeader";
import { EditorInspector } from "./EditorInspector";
import { EditorRail } from "./EditorRail";
import { railChosenTool } from "./editorChrome";
import { EditorContext, type EditorContextValue } from "./editorContext";
import { openTray, takesKeys } from "./editorMode";
import { LayerSelectionBar, useArrangeSelected } from "./LayerSelectionBar";
import { LayersPanel, layerListProps } from "./layers/LayersPanel";
import {
	ContextBarContent,
	DockContent,
	hasInspectorSection,
	type PanelContext,
	ToolTrays,
} from "./PanelViews";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { EyedropperHint } from "./shell/ColorPicker";
import { Dock, DockFooter } from "./shell/Dock";
import { HeaderActions } from "./shell/HeaderActions";
import { SaveErrorBanner } from "./shell/SaveErrorBanner";
import { TrayHeight } from "./shell/ToolOptions";
import { ToolsPanel } from "./shell/ToolsPanel";
import { StickerPopover, StickerSheet } from "./stickers/StickerSheet";
import { useSavedStickers } from "./stickers/useSavedStickers";
import { useStickerActions } from "./stickers/useStickerActions";
import { useStickerSave } from "./stickers/useStickerSave";
import { useStore } from "./store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "./store/editorSlice";
import { TextEditor } from "./text/TextEditor";
import { useReviewZoom } from "./tools/find/useFindTool";
import { useAddImage } from "./useAddImage";
import { useCanvasInput } from "./useCanvasInput";
import { useEditNotice } from "./useEditNotice";
import { useEditorChrome } from "./useEditorChrome";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorMode } from "./useEditorMode";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useEditorTools } from "./useEditorTools";

const parseCustomColor = (saved: unknown) => (isHexColor(saved) ? saved : null);

/**
 * The editor for the session's document.
 * - `saveProblem`: why edits aren't being kept, shown in the header and over
 *   the canvas, with a Retry button when there's `onRetrySave`.
 * - `onLeave`: goes back, called once any text being typed is finished.
 */
export function Editor({
	document,
	saveProblem,
	onRetrySave,
	onLeave,
}: {
	document: EditorDocument;
	saveProblem: string | null;
	onRetrySave?: () => void;
	onLeave: () => void;
}) {
	const router = useRouter();
	// Until the host takes over, the session's key is the project's id.
	const projectId = useStore((state) => state.key);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const actions = useStore((state) => state.actions);
	const {
		addImageLayer,
		addStickerLayer,
		duplicateSelectedLayer,
		setAdjustments,
		transformLayer,
		resizeBox,
		nudgeLayer,
		setLayerResizable,
		selectLayer,
		undo,
		redo,
	} = actions;

	const canvasRef = useRef<EditorCanvasHandle>(null);
	const rootRef = useRef<View>(null);
	const stickerAnchor = useRef<View>(null);

	// What the editor is doing, and what's open over it. A tool puts itself
	// down if its image goes away, or its photo does, and a text color picker
	// closes if other text is styled.
	const targetImage = targetImageLayer(document, selectedLayer);
	const [modeState, dispatchMode] = useEditorMode({
		isAdjustable: (id) => visibleImageLayer(document, id) !== undefined,
		hasPhoto: targetImage !== null,
		selectedTextId: selectedTextLayer?.id ?? null,
	});
	const { mode, eyedropper } = modeState;
	// The tool in the dock. While drawing, strokes on the canvas go into the
	// selected drawing, or a new one; while redacting, into the selected
	// brushed redaction, or a new one. While finding, taps on the canvas pick
	// what's found. While adjusting, the canvas holds still. While cutting
	// out, taps pick a subject, or strokes paint the cut. A tap away from what
	// the tool works on puts it down, as Done does.
	const tool = mode.type === "tool" ? mode.tool : null;
	const cropping = mode.type === "crop";
	const keysTaken = takesKeys(mode);
	const layersOpen = modeState.sheet === "layers";
	const stickersOpen = modeState.sheet === "stickers";

	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);

	const focused = useIsFocused();
	const {
		busy: addBusy,
		dragging,
		pick: pickPhoto,
		addSticker,
		pickSticker,
	} = useAddImage({
		// On web, an image pasted or dropped onto the editor joins the canvas,
		// unless another screen or tool is in front of it.
		enabled: focused && !keysTaken,
		maxShortSide: maxNewImageShortSide(document),
		// The image moves into the project, so autosave knows its file.
		// Without a project, it's used where the picker left it.
		onImage: async ({ uri, width, height, opaque, sticker }) => {
			const url =
				projectId === null ? uri : await addImage(projectId, uri, opaque);
			const area = canvasRef.current?.visibleArea();
			if (sticker) addStickerLayer(url, width, height, opaque, area);
			else addImageLayer(url, width, height, opaque, area);
		},
	});

	const editNotice = useEditNotice(document);

	// Stable, so the sheets' swipes aren't rebuilt on every render.
	const closeLayers = useCallback(
		() => dispatchMode({ type: "closeLayers" }),
		[dispatchMode],
	);
	const closeStickers = useCallback(
		() => dispatchMode({ type: "closeStickers" }),
		[dispatchMode],
	);
	const openStickers = () => dispatchMode({ type: "openStickers" });

	const {
		tools,
		startTool,
		done,
		cancel,
		finishTool,
		closeCrop,
		finishCrop,
		stepToolSize,
		adjustedLayer,
	} = useEditorTools({
		document,
		mode,
		dispatchMode,
		targetImage,
		documentSize,
		pickPhoto,
		openStickers,
		visibleArea: () => canvasRef.current?.visibleArea(),
		onRedacted: editNotice.redacted,
	});

	useReviewZoom(tools.find.review, {
		zoomToArea: (area) => canvasRef.current?.zoomToArea(area),
		fit: () => canvasRef.current?.zoom("fit"),
	});

	const editingText = tools.text.edit !== null;
	const savedStickers = useSavedStickers();
	const stickerSave = useStickerSave(savedStickers.save);
	// Find and Adjust live in the inspector, so they open it even though
	// starting a tool closes the layers sheet. A tall window has it open anyway.
	const layout = useEditorLayout({
		typing: editingText,
		layersOpen,
		inspectorRequested:
			layersOpen || (tool !== null && hasInspectorSection(tool)),
	});
	const { wide, layersBeside, dockInset, inspector, inspectorPinned } = layout;
	const toolOptionsOpen = openTray(mode) !== null;
	const adjusting = useMemo(
		() =>
			adjustedLayer
				? { layerId: adjustedLayer.id, matrix: tools.adjust.matrix }
				: null,
		[adjustedLayer, tools.adjust.matrix],
	);
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
		tools,
		eyedropper,
		editingText,
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

	// Text being typed is finished first, so it goes where the editor does.
	const openExport = () => {
		tools.text.finish();
		router.push(exportHref(projectId));
	};
	const leave = () => {
		tools.text.finish();
		onLeave();
	};

	const { panel, inBar, modeActions } = useEditorChrome({
		tool,
		tools,
		selectedLayer,
		wide,
		done,
		cancel,
	});

	useEditorShortcuts({
		enabled: !keysTaken,
		modeState,
		selection: selectedTextLayer ? "text" : selectedLayer ? "layer" : null,
		dispatchMode,
		undo,
		redo,
		openExport,
		zoom: (to) => canvasRef.current?.zoom(to),
		done,
		startTool,
		editSelected: () => tools.text.editSelected(),
		deleteSelected: () => {
			if (selectedLayer) editNotice.deleteLayer(selectedLayer.id);
		},
		deselect: () => selectLayer(null),
		duplicate: duplicateSelectedLayer,
		arrange: selectedPlace.arrange,
		nudge: (dx, dy) => canvasRef.current?.nudgeSelection(dx, dy),
		stepBrush: stepToolSize,
	});

	const layerList = layerListProps({
		document,
		selectedLayer,
		actions: {
			...actions,
			deleteLayer: editNotice.deleteLayer,
			deleteLayerGroup: editNotice.deleteGroup,
		},
		onFinishText: tools.text.finish,
		onClose: closeLayers,
		bottomInset: dockInset,
	});
	// The sidebar stops above the dock, which stays usable.
	const layersPanel = (
		<LayersPanel
			{...layerList}
			layout={layersBeside ? "sidebar" : "sheet"}
			open={layersOpen}
		/>
	);

	const hasImage = targetImage !== null;
	// What the dock offers for the selected layer, by its kind.
	const layerActions = selectedLayer && {
		layer: selectedLayer,
		startTool,
		sticker: stickerSave.status,
		onSaveSticker: stickerSave.save,
	};

	// What every tool's views read from the editor around them, and what the
	// dock, the bar, the trays, and the inspector read besides.
	const editorContext: EditorContextValue = {
		customColor,
		setCustomColor,
		startEyedropper: (apply) =>
			dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
		trayOpen: toolOptionsOpen,
		toggleTray: () => dispatchMode({ type: "toggleToolOptions" }),
		closeTray: () => dispatchMode({ type: "closeToolOptions" }),
		bottomInset: dockInset,
		cancel,
	};
	const panels: PanelContext = {
		tools,
		dispatchMode,
		layerActions: layerActions || undefined,
		editingText,
		restoreTextFocus: () => tools.text.editorRef.current?.focus(),
	};

	// Takes back the open tool's changes to its image: Adjust's adjustments,
	// or Cut out's cut.
	const resetEdit = adjustedLayer?.adjustments
		? () => setAdjustments(adjustedLayer.id, neutralAdjustments)
		: tools.cutOut.reset;

	// A tap on selected text edits it, with the caret where it landed.
	const editSelectedTextAt =
		selectedTextLayer &&
		((point: Point) =>
			tools.text.editSelected(
				textIndexAt(
					selectedTextLayer,
					toLayerSpace(selectedTextLayer.transform, point),
				),
			));

	const selectionBar = selectedLayer && (
		<LayerSelectionBar
			layer={selectedLayer}
			index={selectedPlace.index}
			topIndex={selectedPlace.topIndex}
			onEdit={() => tools.text.editSelected()}
			onSetResizable={setLayerResizable}
			onArrange={selectedPlace.arrange}
			onDuplicate={duplicateSelectedLayer}
			onDelete={editNotice.deleteLayer}
		/>
	);

	const stickerActions = useStickerActions({
		savedStickers,
		addSticker,
		pickSticker,
		closeStickers,
		waitForDismiss: wide,
	});

	return (
		<TrayHeight.Provider value={layout.setTrayHeight}>
			<EditorContext.Provider value={editorContext}>
				<View ref={rootRef} style={styles.container}>
					<EditorHeader
						wide={wide}
						projectId={projectId}
						document={document}
						saved={!saveProblem}
						onBack={leave}
						bar={
							inBar && modeActions ? (
								<ContextBarContent
									context={panels}
									panel={panel}
									chrome={modeActions}
								/>
							) : undefined
						}
					>
						<HeaderActions
							onReset={resetEdit}
							// A tall window's inspector already shows the layers.
							layers={
								!tool && !editingText && !inspectorPinned
									? {
											open: layersOpen,
											onToggle: () => dispatchMode({ type: "toggleLayers" }),
										}
									: undefined
							}
							// While typing, undo and redo wait: the text isn't a step yet.
							canUndo={canUndo && !editingText}
							canRedo={canRedo && !editingText}
							onUndo={undo}
							onRedo={redo}
							onExport={openExport}
						/>
					</EditorHeader>
					{/* The dock covers the stage's bottom, which runs under it. On a
					    wide screen the rail and inspector rest on it as cards. */}
					<CanvasStage ref={layout.stageRef} toBottom frameless={wide}>
						<EditorCanvas
							ref={canvasRef}
							document={document}
							selectedLayer={selectedLayer}
							textEdit={tools.text.edit}
							onTextSelect={tools.text.select}
							onTextEditDone={tools.text.finish}
							onSelectLayer={selectLayer}
							onTapSelectedLayer={editSelectedTextAt}
							onCommitTransform={transformLayer}
							onResizeBox={resizeBox}
							onNudgeLayer={nudgeLayer}
							{...canvasInput}
							onToolInteractionEnd={() =>
								dispatchMode({ type: "closeToolOptions" })
							}
							onTapAway={done}
							adjusting={adjusting}
							bottomInset={layout.canvasInset.bottom}
							leftInset={layout.canvasInset.left}
							rightInset={layout.canvasInset.right}
							selectionBar={selectionBar}
						/>
						{!wide && (
							<ToolTrays context={panels} modeState={modeState} panel={panel} />
						)}
						{wide && eyedropper && (
							<EyedropperHint
								onCancel={() => dispatchMode({ type: "stopEyedropper" })}
							/>
						)}
						<Announcement message={tools.cutOut.news} />
						{saveProblem && (
							<SaveErrorBanner
								message={saveProblem}
								onRetry={onRetrySave}
								rightInset={layout.coveredRight}
							/>
						)}
						{layersBeside && !wide && layersPanel}
						{wide && (
							<EditorRail
								chosen={railChosenTool({
									tool,
									editingText,
									cropping,
									stickersOpen,
								})}
								addBusy={addBusy}
								hasImage={hasImage}
								startTool={startTool}
								tool={tool}
								finishTool={finishTool}
								finishText={tools.text.finish}
								stickerAnchor={stickerAnchor}
							/>
						)}

						{/* After the tool's options, so taps on the dock reach it rather
				    than closing them. A wide screen has no dock. Its inspector,
				    when the window is tall enough or Layers, Find, or Adjust
				    has it open, is the layers, with Find or Adjust above them. */}
						{inspector ? (
							<EditorInspector
								context={panels}
								panel={panel}
								layerList={layerList}
							/>
						) : !wide ? (
							<Dock
								panel={panel}
								footer={
									modeActions ? <DockFooter {...modeActions} /> : undefined
								}
								keyboardOverlap={layout.keyboardOverlap}
							>
								<DockContent
									context={panels}
									panel={panel}
									idle={
										<ToolsPanel
											addBusy={addBusy}
											hasImage={hasImage}
											startTool={startTool}
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
							inset={{
								left: layout.canvasInset.left,
								right: layout.coveredRight ?? 0,
								bottom: layout.coveredBottom + space.md,
							}}
						/>
					)}
					{wide ? (
						<StickerPopover
							anchor={stickerAnchor}
							open={stickersOpen}
							onClose={closeStickers}
							{...stickerActions}
						/>
					) : (
						<StickerSheet
							open={stickersOpen}
							onClose={closeStickers}
							{...stickerActions}
						/>
					)}

					{dragging && <DropOverlay label="Drop to add to the canvas" />}
					{cropping && (
						<CropTool
							document={document}
							wide={wide}
							onCancel={closeCrop}
							onDone={finishCrop}
						/>
					)}
					{tools.text.edit && (
						<TextEditor
							ref={tools.text.editorRef}
							text={tools.text.edit.layer.text}
							initialSelection={tools.text.edit.initialSelection}
							onChangeText={tools.text.changeText}
							onSelectionChange={tools.text.changeSelection}
							onFocusChange={tools.text.changeFocus}
							onDone={tools.text.finish}
						/>
					)}
					{modeState.shortcutsOpen && (
						<ShortcutsOverlay
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
