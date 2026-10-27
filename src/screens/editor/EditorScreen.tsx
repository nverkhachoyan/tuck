import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import {
	ActivityIndicator,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { isHexColor } from "@/lib/color";
import { neutralAdjustments } from "@/model/adjustments";
import type { EditorDocument } from "@/model/document";
import { targetImageLayer, visibleImageLayer } from "@/model/framing";
import { type Point, toLayerSpace } from "@/model/geometry";
import { maxNewImageShortSide } from "@/model/layers/image";
import type { Layer } from "@/model/layers/layer";
import { usePreference } from "@/platform/usePreference";
import { projectLabel } from "@/projects/projectFile";
import { exportHref } from "@/projects/projectRoute";
import {
	addImage,
	openProjectCreatedAt,
	openProjectName,
} from "@/projects/projectService";
import { textIndexAt } from "@/render/textLayerLayout";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { Announcement } from "@/ui/Announcement";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Toast } from "@/ui/Toast";
import { colors, space, typography } from "@/ui/theme";
import { EditorCanvas, type EditorCanvasHandle } from "./EditorCanvas";
import {
	ContextBarContent,
	DockContent,
	hasInspectorSection,
	ToolTrays,
	toolViewContext,
} from "./EditorDock";
import { EditorInspector } from "./EditorInspector";
import { EditorRail } from "./EditorRail";
import { modeChrome, railChosenTool } from "./editorChrome";
import { openTray, takesKeys } from "./editorMode";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { SaveErrorBanner } from "./session/SaveErrorBanner";
import { useAutosave } from "./session/useAutosave";
import { useProjectSession } from "./session/useProjectSession";
import { EyedropperHint } from "./shell/ColorPicker";
import { Dock, DockFooter, type ModeActionProps } from "./shell/Dock";
import { HeaderActions } from "./shell/HeaderActions";
import { type ArrangeMove, SelectionBar } from "./shell/SelectionBar";
import { TrayHeight } from "./shell/ToolOptions";
import { ToolsPanel } from "./shell/ToolsPanel";
import { CropTool } from "./tools/crop/CropTool";
import { useReviewZoom } from "./tools/find/useFindTool";
import { layerKindName } from "./tools/layers/LayerRow";
import { LayersPanel, layerListProps } from "./tools/layers/LayersPanel";
import { StickerPopover, StickerSheet } from "./tools/stickers/StickerSheet";
import { useSavedStickers } from "./tools/stickers/useSavedStickers";
import { useStickerActions } from "./tools/stickers/useStickerActions";
import { useStickerSave } from "./tools/stickers/useStickerSave";
import { TextEditor } from "./tools/text/TextEditor";
import { useAddImage } from "./useAddImage";
import { useCanvasInput } from "./useCanvasInput";
import { useEditNotice } from "./useEditNotice";
import { RAIL_INSET, useEditorLayout } from "./useEditorLayout";
import { useEditorMode } from "./useEditorMode";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useEditorTools } from "./useEditorTools";

const parseCustomColor = (saved: unknown) => (isHexColor(saved) ? saved : null);

export default function EditorScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const session = useProjectSession(id);

	if (session.status === "open") {
		return <ScreenContent document={session.document} />;
	}

	return (
		<View role="main" style={styles.container}>
			<ScreenHeader
				backLabel="Back to projects"
				onBack={() => leaveEditor(router)}
			/>
			<View style={styles.status}>
				{session.status === "opening" ? (
					<ActivityIndicator color={colors.textSecondary} />
				) : (
					<>
						<Text style={styles.statusTitle}>Couldn't open project</Text>
						<Text style={styles.statusMessage}>{session.message}</Text>
						<View style={styles.statusActions}>
							{session.openElsewhere ? (
								<Button
									label="Back to projects"
									onPress={() => leaveEditor(router)}
								/>
							) : null}
							<Button label="Try again" onPress={session.retry} />
						</View>
					</>
				)}
			</View>
		</View>
	);
}

// Opened from a link or a reload, there's nothing behind the editor; the
// welcome screen still ends the session.
function leaveEditor(router: ReturnType<typeof useRouter>) {
	if (router.canGoBack()) router.back();
	else router.replace("/");
}

// For a save as the app leaves the foreground, or a pick finished, before
// React has rendered.
const latestDocument = () => useStore.getState().document;

function ScreenContent({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const projectId = useStore((state) => state.projectId);
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
		moveLayer,
		setLayerResizable,
		selectLayer,
		undo,
		redo,
	} = actions;

	const canvasRef = useRef<EditorCanvasHandle>(null);
	const rootRef = useRef<View>(null);
	const stickerAnchor = useRef<View>(null);

	// What the editor is doing, and what's open over it. Adjust puts itself
	// down if its image goes away, Find if its photo does, and a text color
	// picker closes if other text is styled.
	const targetImage = targetImageLayer(document, selectedLayer);
	const [modeState, dispatchMode] = useEditorMode({
		isAdjustable: (id) => visibleImageLayer(document, id) !== undefined,
		canFind: targetImage !== null,
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
		redactLook,
		changeRedactLook,
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
	const { styledText } = tools.text;
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
		size: documentSize,
		tool,
		eyedropper,
		editingText,
		draw: tools.draw.settings,
		redact: tools.redact.settings,
		cut: tools.cut,
		find: targetImage && {
			imageId: targetImage.id,
			regions: tools.find.overlay,
			onToggle: tools.find.toggle,
		},
		adjustController: tools.adjust,
		actions,
		dispatchMode,
		onCustomColor: setCustomColor,
	});

	const { error: autosaveError, retry: retryAutosave } = useAutosave(
		projectId,
		document,
		latestDocument,
	);
	const saveProblem =
		projectId === null
			? "This project couldn't be saved, so your edits won't be kept."
			: autosaveError;

	// Web-only and display-only details: inert takes the editor out of the tab
	// order and accessibility tree under the export sheet on web, and what home
	// lists the project as for the wide header.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const root = rootRef.current as unknown as HTMLElement | null;
		root?.toggleAttribute("inert", !focused);
	}, [focused]);
	const title = useMemo(
		() => projectTitle(projectId, document),
		[projectId, document],
	);

	const selectedIndex = selectedLayer
		? document.layers.indexOf(selectedLayer)
		: -1;
	const topIndex = document.layers.length - 1;
	const arrangeSelected = (move: ArrangeMove) => {
		if (!selectedLayer) return;
		const to = {
			front: topIndex,
			forward: selectedIndex + 1,
			backward: selectedIndex - 1,
			back: 0,
		};
		moveLayer(selectedLayer.id, to[move]);
	};

	// Text being typed is finished first, so it goes where the editor does.
	const openExport = () => {
		tools.text.finish();
		router.push(exportHref(projectId));
	};
	const leave = () => {
		tools.text.finish();
		leaveEditor(router);
	};

	// The dock's panel, and its Cancel, Done, and title, chosen once for both
	// layouts. A wide screen's open tool, or a selected layer, lives in the
	// header. Find's results and Adjust's dial sit in the inspector, above the
	// layers.
	const chrome = modeChrome({
		tool,
		editingText,
		styledText: styledText !== undefined,
		layerName: selectedLayer ? layerKindName(selectedLayer) : null,
		findChosen: tools.find.selectedCount,
		wide,
	});
	const { panel, inBar } = chrome;

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
		arrange: arrangeSelected,
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

	// What the dock, the bar, the trays, and the inspector read.
	const toolViews = toolViewContext({
		tools,
		dispatchMode,
		customColor,
		onCustomColor: setCustomColor,
		optionsOpen: toolOptionsOpen,
		bottomInset: dockInset,
		onFind: targetImage ? startTool.find : undefined,
		onCancel: cancel,
		redactLook,
		changeRedactLook,
		adjustments: adjustedLayer?.adjustments,
		layerActions: layerActions || undefined,
		editingText,
		restoreTextFocus: () => tools.text.editorRef.current?.focus(),
	});

	// Takes back the open tool's changes to its image: Adjust's adjustments,
	// or Cut out's cut.
	const resetEdit = adjustedLayer?.adjustments
		? () => setAdjustments(adjustedLayer.id, neutralAdjustments)
		: tools.cut.reset;

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
			index={selectedIndex}
			topIndex={topIndex}
			onEdit={() => tools.text.editSelected()}
			onSetResizable={setLayerResizable}
			onArrange={arrangeSelected}
			onDuplicate={duplicateSelectedLayer}
			onDelete={editNotice.deleteLayer}
		/>
	);

	// The dock's footer and the context bar's title, Cancel, and Done, for
	// the open tool, the text being typed or styled, or the selected layer.
	const onCancel = { tool: cancel, text: tools.text.cancel };
	const onDone = {
		tool: done,
		text: tools.text.finish,
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

	const stickerActions = useStickerActions({
		savedStickers,
		addSticker,
		pickSticker,
		closeStickers,
		waitForDismiss: wide,
	});

	return (
		<TrayHeight.Provider value={layout.setTrayHeight}>
			<View ref={rootRef} style={styles.container}>
				<EditorHeader
					wide={wide}
					title={title}
					saved={!saveProblem}
					onBack={leave}
					bar={
						inBar && modeActions ? (
							<ContextBarContent
								context={toolViews}
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
						<ToolTrays
							context={toolViews}
							modeState={modeState}
							panel={panel}
						/>
					)}
					{wide && eyedropper && (
						<EyedropperHint
							onCancel={() => dispatchMode({ type: "stopEyedropper" })}
						/>
					)}
					<Announcement message={tools.cut.news} />
					{saveProblem && (
						<SaveErrorBanner
							message={saveProblem}
							onRetry={projectId !== null ? retryAutosave : undefined}
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
							context={toolViews}
							panel={panel}
							layerList={layerList}
						/>
					) : !wide ? (
						<Dock
							panel={panel}
							footer={modeActions ? <DockFooter {...modeActions} /> : undefined}
							keyboardOverlap={layout.keyboardOverlap}
						>
							<DockContent
								context={toolViews}
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
		</TrayHeight.Provider>
	);
}

/** What home lists the project as, for the wide header. */
function projectTitle(projectId: string | null, document: EditorDocument) {
	if (projectId === null) return projectLabel(document, Date.now());
	return (
		openProjectName(projectId) ||
		projectLabel(document, openProjectCreatedAt(projectId) ?? Date.now())
	);
}

/**
 * The editor's header. Back and Export stay through every tool and while
 * typing: leaving keeps the changes, as the browser's own Back does.
 * - `bar`: the open tool's context bar, on a wide screen.
 * - `title`, `saved`: the project and whether it's kept, shown only on a wide
 *   screen with no bar, where there's room between Back and the actions.
 */
function EditorHeader({
	wide,
	title,
	saved,
	onBack,
	bar,
	children,
}: {
	wide: boolean;
	title: string;
	saved: boolean;
	onBack: () => void;
	bar?: ReactNode;
	children: ReactNode;
}) {
	const titled = wide && !bar;
	return (
		<ScreenHeader
			backLabel="Back to projects"
			// Over the rail's tools.
			backColumn={wide ? RAIL_INSET : undefined}
			onBack={onBack}
			title={titled ? title : undefined}
			subtitle={
				titled ? (saved ? "Saved on this device" : "Not saved") : undefined
			}
			bar={bar}
			action={children}
		/>
	);
}

/**
 * The selection bar for `layer`, at `index` in the stack: Edit for text and
 * Free resize for text and images.
 */
function LayerSelectionBar({
	layer,
	index,
	topIndex,
	onEdit,
	onSetResizable,
	onArrange,
	onDuplicate,
	onDelete,
}: {
	layer: Layer;
	index: number;
	topIndex: number;
	onEdit: () => void;
	onSetResizable: (id: string, resizable: boolean) => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: (id: string) => void;
}) {
	const resizable = layer.type === "text" || layer.type === "image";
	return (
		<SelectionBar
			canMoveForward={index < topIndex}
			canMoveBackward={index > 0}
			onEdit={layer.type === "text" ? onEdit : undefined}
			stretched={layer.resizable === true}
			onToggleStretch={
				resizable ? () => onSetResizable(layer.id, !layer.resizable) : undefined
			}
			onArrange={onArrange}
			onDuplicate={onDuplicate}
			onDelete={() => onDelete(layer.id)}
		/>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	status: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 24,
	},
	statusTitle: {
		...typography.title,
		color: colors.textPrimary,
	},
	statusMessage: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
	},
	statusActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: space.sm,
		marginTop: space.sm,
	},
});
