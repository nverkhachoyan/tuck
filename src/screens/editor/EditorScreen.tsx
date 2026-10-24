import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { errorMessage } from "@/lib/errorMessage";
import { neutralAdjustments } from "@/model/adjustments";
import type { EditorDocument } from "@/model/document";
import {
	type Framing,
	targetImageLayer,
	visibleImageLayer,
} from "@/model/framing";
import { type Point, toLayerSpace } from "@/model/geometry";
import { maxNewImageShortSide } from "@/model/layers/image";
import { usePreference } from "@/platform/usePreference";
import { projectLabel } from "@/projects/projectFile";
import { exportHref } from "@/projects/projectRoute";
import { addImage, openProjectName } from "@/projects/projectService";
import { textIndexAt } from "@/render/textLayerLayout";
import {
	selectSelectedLayer,
	selectSelectedTextLayer,
	useStore,
} from "@/store";
import { Announcement } from "@/ui/Announcement";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { showAlert } from "@/ui/showAlert";
import { Toast } from "@/ui/Toast";
import { colors, space, typography } from "@/ui/theme";
import { EditorCanvas, type EditorCanvasHandle } from "./canvas/EditorCanvas";
import {
	DockContent,
	type DockPanel,
	HeaderActions,
	layerActionsFor,
	layerListProps,
	type ToolStarters,
	ToolTrays,
	toolButtonsFor,
} from "./EditorDock";
import { type ShortcutCommand, shortcutCommand, takesKeys } from "./editorMode";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { SaveErrorBanner } from "./session/SaveErrorBanner";
import { useAutosave } from "./session/useAutosave";
import { useProjectSession } from "./session/useProjectSession";
import { Dock, DockFooter, InspectorBackdrop } from "./shell/Dock";
import { type ArrangeMove, SelectionBar } from "./shell/SelectionBar";
import { TrayHeight, TrayPlacement } from "./shell/ToolOptions";
import { ToolsPanel } from "./shell/ToolsPanel";
import type { Shortcut } from "./shortcuts";
import { useAdjustController } from "./tools/adjust/useAdjustController";
import { CropTool } from "./tools/crop/CropTool";
import { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { useDrawTool } from "./tools/draw/useDrawTool";
import { useFindTool } from "./tools/find/useFindTool";
import { layerKindName } from "./tools/layers/LayerRow";
import { LayersPanel } from "./tools/layers/LayersPanel";
import { redactionEffect } from "./tools/redact/redactSettings";
import { useRedactTool } from "./tools/redact/useRedactTool";
import { StickerSheet } from "./tools/stickers/StickerSheet";
import type { StickerImage } from "./tools/stickers/savedStickers";
import { bundledStickerImage } from "./tools/stickers/stickerFile";
import { useSavedStickers } from "./tools/stickers/useSavedStickers";
import { useStickerSave } from "./tools/stickers/useStickerSave";
import { TextEditor } from "./tools/text/TextEditor";
import { type TextEditing, useTextEditing } from "./tools/text/useTextEditing";
import { useAddImage } from "./useAddImage";
import { useCanvasInput } from "./useCanvasInput";
import { useDeleteNotice } from "./useDeleteNotice";
import { useEditorActions } from "./useEditorActions";
import { RAIL_WIDTH, useEditorLayout } from "./useEditorLayout";
import { useEditorMode } from "./useEditorMode";
import { useEditorShortcuts } from "./useEditorShortcuts";

// What a tool's footer calls it.
const TOOL_TITLES = {
	draw: "Draw",
	redact: "Redact",
	find: "Find",
	adjust: "Adjust",
	cutOut: "Cut out",
};

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
						<Button label="Try Again" onPress={session.retry} />
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
	const actions = useEditorActions();
	const {
		addImageLayer,
		addStickerLayer,
		duplicateSelectedLayer,
		addMaskedRedaction,
		setAdjustments,
		transformLayer,
		resizeBox,
		nudgeLayer,
		moveLayer,
		setLayerResizable,
		reframe,
		selectLayer,
		undo,
		redo,
		beginSession,
		commitSession,
		cancelSession,
	} = actions;

	const canvasRef = useRef<EditorCanvasHandle>(null);

	// What the editor is doing, and what's open over it. Adjust puts itself
	// down if its image goes away, Find if its photo does, and a text color
	// picker closes if other text is styled.
	const targetImage = targetImageLayer(document, selectedLayer);
	const [modeState, dispatchMode] = useEditorMode<TextEditing>({
		isAdjustable: (id) => visibleImageLayer(document, id) !== undefined,
		canFind: targetImage !== null,
		selectedTextId: selectedTextLayer?.id ?? null,
	});
	const { mode, eyedropper } = modeState;
	const textEditing = useTextEditing({
		document,
		edit: mode.type === "text" ? mode.edit : null,
		dispatchMode,
	});
	const { styledText } = textEditing;
	const editingText = textEditing.edit !== null;
	const cropping = mode.type === "crop";
	const keysTaken = takesKeys(mode);
	const layersOpen = modeState.sheet === "layers";
	const stickersOpen = modeState.sheet === "stickers";
	const savedStickers = useSavedStickers();
	const stickerSave = useStickerSave(savedStickers.save);
	const layout = useEditorLayout({ typing: editingText, layersOpen });
	const { wide, layersBeside, dockInset } = layout;
	// The tool in the dock. While drawing, strokes on the canvas go into the
	// selected drawing, or a new one; while redacting, into the selected
	// brushed redaction, or a new one. While finding, taps on the canvas pick
	// what's found. While adjusting, the canvas holds still. While cutting
	// out, taps pick a subject, or strokes paint the cut. A tap away from what
	// the tool works on puts it down, as Done does.
	const tool = mode.type === "tool" ? mode.tool : null;
	const toolOptionsOpen =
		mode.type === "tool" && mode.tool !== "adjust" && mode.optionsOpen;
	const adjustedLayer =
		mode.type === "tool" && mode.tool === "adjust"
			? visibleImageLayer(document, mode.layerId)
			: undefined;
	const cutLayer =
		mode.type === "tool" && mode.tool === "cutOut"
			? visibleImageLayer(document, mode.layerId)
			: undefined;
	// A tool's changes are one session: one undo step, or none if canceled.
	// Closing the tool any way, leaving the editor included, keeps them.
	useEffect(() => {
		if (!tool) return;
		beginSession();
		return commitSession;
	}, [tool, beginSession, commitSession]);
	const adjustController = useAdjustController(adjustedLayer, setAdjustments);
	const adjusting = useMemo(
		() =>
			adjustedLayer
				? { layerId: adjustedLayer.id, matrix: adjustController.matrix }
				: null,
		[adjustedLayer, adjustController.matrix],
	);
	// The last color picked from a color picker, which every custom swatch
	// keeps while a preset is in use. Null until there's one. Like the tools'
	// settings, it's kept between sessions.
	const [customColor, setCustomColor] = usePreference(
		"customColor",
		parseCustomColor,
	);
	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);
	const draw = useDrawTool(tool === "draw", documentSize);
	const redact = useRedactTool(documentSize);
	const find = useFindTool(document, targetImage);
	// Redacting the cut's selection puts the image back as it was before
	// Cut out, with a redaction over what was selected, and goes on to
	// Redact to choose how it hides it.
	const cut = useCutOutTool({
		layer: cutLayer,
		onRedact: (layerId, mask, rect) => {
			cancelSession();
			addMaskedRedaction(
				layerId,
				mask,
				rect,
				redactionEffect(redact.chosen, documentSize),
			);
			// Box, which moves the redaction, as `chooseTool` would pick
			// once it's selected: this render hasn't seen it yet.
			redact.setChosen((current) => ({ ...current, tool: "box" }));
			dispatchMode({ type: "startTool", tool: "redact" });
		},
	});
	const canvasInput = useCanvasInput({
		document,
		size: documentSize,
		tool,
		eyedropper,
		editingText,
		draw: draw.settings,
		redact: redact.settings,
		cut,
		findImageId: targetImage?.id ?? null,
		onFindToggle: find.toggle,
		adjustController,
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

	// What home lists the project as: the name it was given, or its text.
	const projectTitle = useMemo(
		() =>
			(projectId !== null && openProjectName(projectId)) ||
			projectLabel(document),
		[projectId, document],
	);

	const deleteNotice = useDeleteNotice(document);

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

	const startDrawing = () => {
		draw.chooseTool();
		dispatchMode({ type: "startTool", tool: "draw" });
	};
	const startRedacting = () => {
		redact.chooseTool();
		dispatchMode({ type: "startTool", tool: "redact" });
	};
	const startAdjusting = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startAdjust", layerId: targetImage.id });
	};
	const closeTool = () => {
		dispatchMode({ type: "endTool" });
		find.reset();
	};
	// Done with Draw or Redact goes back to the tools, not to the last stroke
	// or box, still selected, where a stray drag would move it.
	const finishTool = () => {
		closeTool();
		if (tool === "draw" || tool === "redact") selectLayer(null);
	};
	const cancelTool = () => {
		cancelSession();
		closeTool();
	};
	// The selected photo, or else the main one, like Find.
	const startCutOut = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startCutOut", layerId: targetImage.id });
		cut.start(targetImage);
	};
	// In the selected photo, or else the main one.
	const startFinding = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startTool", tool: "find" });
	};
	// Find is one of Redact's tools, so Cancel goes back to Redact. Done
	// redacts the regions chosen, in the style last picked rather than a
	// selected redaction's, and goes back to the tools, as Redact's Done does.
	const backToRedacting = () => {
		find.reset();
		startRedacting();
	};
	const finishFinding = () => {
		find.redactChosen(redactionEffect(redact.chosen, documentSize));
		closeTool();
		selectLayer(null);
	};
	const doneWithTool = tool === "find" ? finishFinding : finishTool;
	const cancelWithTool = tool === "find" ? backToRedacting : cancelTool;

	// Text being typed is finished first, so it goes where the editor does.
	const openExport = () => {
		textEditing.finish();
		router.push(exportHref(projectId));
	};
	const leave = () => {
		textEditing.finish();
		leaveEditor(router);
	};

	const startNewText = () =>
		textEditing.startNew(canvasRef.current?.visibleArea());

	const startCrop = () => dispatchMode({ type: "startCrop" });
	const closeCrop = useCallback(
		() => dispatchMode({ type: "endCrop" }),
		[dispatchMode],
	);
	const finishCrop = (framing: Framing, turnLayers: boolean) => {
		reframe(framing, turnLayers);
		closeCrop();
	};

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

	// Which shortcut does what, given what's open, is `shortcutCommand`'s.
	const handleShortcut = (shortcut: Shortcut): boolean => {
		const command = shortcutCommand(
			modeState,
			selectedTextLayer ? "text" : selectedLayer ? "layer" : null,
			shortcut,
		);
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
				canvasRef.current?.zoom(command.to);
				break;
			case "doneWithTool":
				doneWithTool();
				break;
			case "tool":
				startTool[command.tool]();
				break;
			case "layers":
				dispatchMode({ type: "toggleLayers" });
				break;
			case "edit":
				textEditing.editSelected();
				break;
			case "delete":
				if (selectedLayer) deleteNotice.deleteLayer(selectedLayer.id);
				break;
			case "deselect":
				selectLayer(null);
				break;
			case "duplicate":
				duplicateSelectedLayer();
				break;
			case "reorder":
				arrangeSelected(command.step === 1 ? "forward" : "backward");
				break;
			case "nudge":
				canvasRef.current?.nudgeSelection(command.dx, command.dy);
				break;
			default:
				assertNever(command);
		}
	};
	useEditorShortcuts({
		enabled: !keysTaken,
		onShortcut: handleShortcut,
	});

	const panelKind: DockPanel = tool
		? tool
		: styledText
			? "text"
			: selectedLayer
				? "layer"
				: "idle";

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

	// What each tool's key, button, and layer action picks up. A selected
	// drawing or redaction takes the strokes, as its own Draw or Redact does.
	const startTool: ToolStarters = {
		text: startNewText,
		draw: startDrawing,
		redact: startRedacting,
		find: startFinding,
		sticker: openStickers,
		photo: pickPhoto,
		crop: startCrop,
		adjust: startAdjusting,
		cutOut: startCutOut,
	};

	const layerList = layerListProps({
		document,
		selectedLayer,
		actions: {
			...actions,
			deleteLayer: deleteNotice.deleteLayer,
			deleteLayerGroup: deleteNotice.deleteGroup,
		},
		onFinishText: textEditing.finish,
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

	// A tool picked from the rail while another is open finishes that one.
	const fromRail = (start: () => void) => () => {
		if (tool) finishTool();
		textEditing.finish();
		start();
	};
	// The tools' buttons, for the dock and, through `fromRail`, the rail.
	const toolButtons = {
		startTool,
		addBusy,
		hasImage: targetImage !== null,
	};
	// What the dock offers for the selected layer, by its kind.
	const layerActions =
		selectedLayer &&
		layerActionsFor({
			layer: selectedLayer,
			startTool,
			sticker: stickerSave.status,
			onSaveSticker: stickerSave.save,
		});

	// Takes back the open tool's changes to its image: Adjust's adjustments,
	// or Cut out's cut.
	const resetEdit = adjustedLayer?.adjustments
		? () => setAdjustments(adjustedLayer.id, neutralAdjustments)
		: cut.reset;

	// A tap on selected text edits it, with the caret where it landed.
	const editSelectedTextAt =
		selectedTextLayer &&
		((point: Point) =>
			textEditing.editSelected(
				textIndexAt(
					selectedTextLayer,
					toLayerSpace(selectedTextLayer.transform, point),
				),
			));

	const selectionBar = selectedLayer && (
		<SelectionBar
			canMoveForward={selectedIndex < topIndex}
			canMoveBackward={selectedIndex > 0}
			onEdit={selectedTextLayer ? () => textEditing.editSelected() : undefined}
			stretched={selectedLayer.resizable === true}
			onToggleStretch={
				selectedLayer.type === "text" || selectedLayer.type === "image"
					? () => setLayerResizable(selectedLayer.id, !selectedLayer.resizable)
					: undefined
			}
			onArrange={arrangeSelected}
			onDuplicate={duplicateSelectedLayer}
			onDelete={() => deleteNotice.deleteLayer(selectedLayer.id)}
		/>
	);

	// The dock's Cancel and Done, for the open tool, the text being typed, or
	// the selected layer.
	const dockFooter = tool ? (
		<DockFooter
			title={TOOL_TITLES[tool]}
			onCancel={cancelWithTool}
			onDone={doneWithTool}
			doneLabel={
				tool === "find" && find.selectedCount > 0
					? `Redact ${find.selectedCount} selected`
					: undefined
			}
			doneShortcut="Escape"
		/>
	) : editingText ? (
		<DockFooter
			title="Text"
			onCancel={textEditing.cancel}
			onDone={textEditing.finish}
			doneShortcut="Escape"
		/>
	) : selectedLayer ? (
		<DockFooter
			title={layerKindName(selectedLayer)}
			onDone={() => selectLayer(null)}
			doneShortcut="Escape"
		/>
	) : undefined;

	const addStickerFrom = (load: () => Promise<StickerImage | null>) => {
		closeStickers();
		addSticker(load);
	};

	return (
		<TrayHeight.Provider value={layout.setTrayHeight}>
			<TrayPlacement.Provider value={layout.trayPlacement}>
				<View style={styles.container}>
					{/* Back and Export stay through every tool and while typing:
					    leaving keeps the changes, as the browser's own Back does. */}
					<ScreenHeader
						backLabel="Back to projects"
						onBack={leave}
						// Only a wide screen has room between Back and the actions.
						title={wide ? projectTitle : undefined}
						subtitle={saveProblem ? "Not saved" : "Saved on this device"}
						action={
							<HeaderActions
								typing={editingText}
								onReset={resetEdit}
								// A wide screen's inspector always shows the layers.
								layers={
									!tool && !editingText && !wide
										? {
												open: layersOpen,
												onToggle: () => dispatchMode({ type: "toggleLayers" }),
											}
										: undefined
								}
								onExport={openExport}
							/>
						}
					/>
					{/* The dock covers the stage's bottom, which runs under it. */}
					<CanvasStage ref={layout.stageRef} toBottom>
						<EditorCanvas
							ref={canvasRef}
							document={document}
							selectedLayer={selectedLayer}
							textEdit={textEditing.edit}
							onTextSelect={textEditing.select}
							onTextEditDone={textEditing.finish}
							onSelectLayer={selectLayer}
							onTapSelectedLayer={editSelectedTextAt}
							onCommitTransform={transformLayer}
							onResizeBox={resizeBox}
							onNudgeLayer={nudgeLayer}
							{...canvasInput}
							detections={
								tool === "find" && !eyedropper ? find.overlay : undefined
							}
							onToolInteractionEnd={() =>
								dispatchMode({ type: "closeToolOptions" })
							}
							onTapAway={doneWithTool}
							adjusting={adjusting}
							bottomInset={layout.canvasInset.bottom}
							leftInset={layout.canvasInset.left}
							rightInset={layout.canvasInset.right}
							selectionBar={selectionBar}
						/>
						{wide && <InspectorBackdrop />}
						<ToolTrays
							modeState={modeState}
							dispatchMode={dispatchMode}
							draw={draw}
							redact={redact}
							find={find}
							cut={cut}
							textEditing={textEditing}
							customColor={customColor}
							onCustomColor={setCustomColor}
							bottomInset={dockInset}
						/>
						<Announcement message={cut.news} />
						{saveProblem && (
							<SaveErrorBanner
								message={saveProblem}
								onRetry={projectId !== null ? retryAutosave : undefined}
								rightInset={layout.coveredRight}
							/>
						)}
						{layersBeside && !wide && layersPanel}
						{wide && (
							<View style={styles.rail}>
								<ToolsPanel
									vertical
									tool={editingText ? "text" : tool}
									{...toolButtonsFor(toolButtons, fromRail)}
								/>
							</View>
						)}

						{/* After the tool's options, so taps on the dock reach it rather
				    than closing them. */}
						<Dock
							panel={panelKind}
							layout={wide ? "inspector" : "bar"}
							footer={dockFooter}
							keyboardOverlap={layout.keyboardOverlap}
						>
							<DockContent
								panel={panelKind}
								optionsOpen={toolOptionsOpen}
								onFind={targetImage ? startFinding : undefined}
								dispatchMode={dispatchMode}
								draw={draw}
								redact={redact}
								find={find}
								cut={cut}
								adjustController={adjustController}
								adjustments={adjustedLayer?.adjustments}
								textEditing={textEditing}
								customColor={customColor}
								layerActions={layerActions}
								idle={
									wide ? (
										<LayersPanel {...layerList} layout="inspector" open />
									) : (
										<ToolsPanel {...toolButtonsFor(toolButtons)} />
									)
								}
							/>
						</Dock>
					</CanvasStage>
					{!layersBeside && layersPanel}
					{deleteNotice.message && (
						<Toast
							message={deleteNotice.message}
							action="Undo"
							onAction={deleteNotice.undo}
							inset={{
								left: layout.canvasInset.left,
								right: layout.coveredRight ?? 0,
								bottom: layout.coveredBottom + space.md,
							}}
						/>
					)}
					<StickerSheet
						open={stickersOpen}
						onClose={closeStickers}
						onAddSticker={(sticker) =>
							addStickerFrom(() => bundledStickerImage(sticker))
						}
						savedStickers={savedStickers.stickers}
						savedError={savedStickers.error}
						onAddSaved={(sticker) =>
							addStickerFrom(() => savedStickers.place(sticker))
						}
						// Kept, then added at once, as it was picked to use.
						onSaveNew={() => {
							closeStickers();
							pickSticker(async (image) =>
								savedStickers.place(await savedStickers.save(image)),
							);
						}}
						onDeleteSaved={(sticker) => {
							savedStickers.remove(sticker).catch((error: unknown) => {
								showAlert("Couldn't delete sticker", errorMessage(error));
							});
						}}
					/>

					{dragging && <DropOverlay label="Drop to add to the canvas" />}
					{cropping && (
						<CropTool
							document={document}
							onCancel={closeCrop}
							onDone={finishCrop}
						/>
					)}
					{textEditing.edit && (
						<TextEditor
							ref={textEditing.editorRef}
							text={textEditing.edit.layer.text}
							initialSelection={textEditing.edit.initialSelection}
							onChangeText={textEditing.changeText}
							onSelectionChange={textEditing.changeSelection}
							onFocusChange={textEditing.changeFocus}
							onDone={textEditing.finish}
						/>
					)}
					{modeState.shortcutsOpen && (
						<ShortcutsOverlay
							onClose={() => dispatchMode({ type: "closeShortcuts" })}
						/>
					)}
				</View>
			</TrayPlacement.Provider>
		</TrayHeight.Provider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	rail: {
		position: "absolute",
		top: 0,
		left: 0,
		bottom: 0,
		width: RAIL_WIDTH,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderRightColor: colors.border,
		backgroundColor: colors.background,
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
		marginBottom: 12,
	},
});
