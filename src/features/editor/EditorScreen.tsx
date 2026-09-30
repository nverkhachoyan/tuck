import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { detectionTarget } from "@/detection/detectionTarget";
import { AddSheet } from "@/features/editor/add/AddSheet";
import { AdjustPanel } from "@/features/editor/adjust/AdjustPanel";
import {
	adjustTarget,
	useAdjustController,
} from "@/features/editor/adjust/useAdjustController";
import { EyedropperHint } from "@/features/editor/ColorPicker";
import { isCustomColor } from "@/features/editor/ColorSwatches";
import {
	EditorCanvas,
	type EditorCanvasHandle,
} from "@/features/editor/canvas/EditorCanvas";
import type { CanvasTool } from "@/features/editor/canvas/EditorScene";
import { CropTool } from "@/features/editor/crop/CropTool";
import {
	Dock,
	DockFooter,
	INSPECTOR_TRAY_TOP,
	INSPECTOR_WIDTH,
	InspectorBackdrop,
	useDockInset,
} from "@/features/editor/Dock";
import { brushFor, shapeStyleFor } from "@/features/editor/draw/brushSettings";
import { BrushOptions, DrawPanel } from "@/features/editor/draw/DrawPanel";
import { useDrawTool } from "@/features/editor/draw/useDrawTool";
import {
	type ShortcutCommand,
	shortcutCommand,
	takesKeys,
} from "@/features/editor/editorMode";
import { LayerActionsPanel } from "@/features/editor/panels/LayerActionsPanel";
import { layerKindName } from "@/features/editor/panels/LayerRow";
import {
	LAYERS_SIDEBAR_INSET,
	LayersPanel,
} from "@/features/editor/panels/LayersPanel";
import {
	type ArrangeMove,
	SelectionBar,
} from "@/features/editor/panels/SelectionBar";
import {
	type CutOutState,
	ToolsPanel,
} from "@/features/editor/panels/ToolsPanel";
import {
	DetectionOptions,
	FindPanel,
} from "@/features/editor/redact/DetectionOptions";
import {
	RedactOptions,
	RedactPanel,
} from "@/features/editor/redact/RedactPanel";
import {
	maskBrush,
	redactionEffect,
} from "@/features/editor/redact/redactSettings";
import { useFindTool } from "@/features/editor/redact/useFindTool";
import { useRedactTool } from "@/features/editor/redact/useRedactTool";
import { SaveErrorBanner } from "@/features/editor/SaveErrorBanner";
import { ShortcutsOverlay } from "@/features/editor/ShortcutsOverlay";
import {
	LAYERS_KEY,
	type Shortcut,
	type ToolKey,
} from "@/features/editor/shortcuts";
import { TrayHeight, TrayPlacement } from "@/features/editor/ToolOptions";
import { TextEditor } from "@/features/editor/text/TextEditor";
import {
	TextColorPicker,
	TextStylePanel,
} from "@/features/editor/text/TextStylePanel";
import {
	type TextEditing,
	useTextEditing,
} from "@/features/editor/text/useTextEditing";
import { useAddImage } from "@/features/editor/useAddImage";
import { useCutOut } from "@/features/editor/useCutOut";
import { useEditorMode } from "@/features/editor/useEditorMode";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { useStickerSave } from "@/features/editor/useStickerSave";
import { textIndexAt } from "@/layers/textLayerLayout";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { errorMessage } from "@/lib/errorMessage";
import { usePreference } from "@/lib/usePreference";
import { neutralAdjustments } from "@/model/adjustments";
import {
	type EditorDocument,
	type ImageLayer,
	maxNewImageShortSide,
	type ShapePlacement,
} from "@/model/document";
import type { Framing } from "@/model/framing";
import { type Point, type Rect, toLayerSpace } from "@/model/geometry";
import { exportHref } from "@/projects/projectRoute";
import { addImage } from "@/projects/projectService";
import { useAutosave } from "@/projects/useAutosave";
import { useProjectSession } from "@/projects/useProjectSession";
import { renderThumbnail, sampleColor } from "@/render/renderDocument";
import { bundledStickerImage } from "@/stickers/stickerFile";
import { useSavedStickers } from "@/stickers/useSavedStickers";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors, typography } from "@/theme";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { showAlert } from "@/ui/showAlert";
import { TextButton } from "@/ui/TextButton";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;
// Wide enough for a tool rail at the left and an inspector at the right,
// which the dock, its trays, and the layers move into.
const INSPECTOR_MIN_WIDTH = 1024;
const RAIL_WIDTH = 76;
const INSPECTOR_TRAY = { top: INSPECTOR_TRAY_TOP, width: INSPECTOR_WIDTH };

// What a tool's footer calls it.
const TOOL_TITLES = {
	draw: "Draw",
	redact: "Redact",
	find: "Find",
	adjust: "Adjust",
};

const parseCustomColor = (saved: unknown) => (isHexColor(saved) ? saved : null);

// An image Adjust can work on: there, and shown.
function adjustableImage(document: EditorDocument, id: string) {
	return document.layers.find(
		(layer): layer is ImageLayer =>
			layer.type === "image" && !layer.hidden && layer.id === id,
	);
}

export default function EditorScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const session = useProjectSession(id, renderThumbnail);

	if (session.status === "open") {
		return <ScreenContent document={session.document} />;
	}

	return (
		<View style={styles.container}>
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

// For a save as the app leaves the foreground, before React has rendered.
const latestDocument = () => useStore.getState().document;

function ScreenContent({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const projectId = useStore((state) => state.projectId);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const addImageLayer = useStore((state) => state.addImageLayer);
	const addStickerLayer = useStore((state) => state.addStickerLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
	const drawStroke = useStore((state) => state.drawStroke);
	const addRedactionBox = useStore((state) => state.addRedactionBox);
	const setLayerGroupHidden = useStore((state) => state.setLayerGroupHidden);
	const setLayerGroupLocked = useStore((state) => state.setLayerGroupLocked);
	const deleteLayerGroup = useStore((state) => state.deleteLayerGroup);
	const paintRedaction = useStore((state) => state.paintRedaction);
	const addShape = useStore((state) => state.addShape);
	const setAdjustments = useStore((state) => state.setAdjustments);
	const transformLayer = useStore((state) => state.transformLayer);
	const resizeBox = useStore((state) => state.resizeBox);
	const nudgeLayer = useStore((state) => state.nudgeLayer);
	const moveLayer = useStore((state) => state.moveLayer);
	const setLayerHidden = useStore((state) => state.setLayerHidden);
	const setLayerLocked = useStore((state) => state.setLayerLocked);
	const setLayerResizable = useStore((state) => state.setLayerResizable);
	const setBackground = useStore((state) => state.setBackground);
	const reframe = useStore((state) => state.reframe);
	const deleteLayer = useStore((state) => state.deleteLayer);
	const selectLayer = useStore((state) => state.selectLayer);
	const undo = useStore((state) => state.undo);
	const redo = useStore((state) => state.redo);
	const beginSession = useStore((state) => state.beginSession);
	const commitSession = useStore((state) => state.commitSession);
	const cancelSession = useStore((state) => state.cancelSession);

	const canvasRef = useRef<EditorCanvasHandle>(null);

	// What the editor is doing, and what's open over it. Adjust puts itself
	// down if its image goes away, Find if its photo does, and a text color
	// picker closes if other text is styled.
	const detectedImage = detectionTarget(document, selectedLayer);
	const [modeState, dispatchMode] = useEditorMode<TextEditing>({
		isAdjustable: (id) => adjustableImage(document, id) !== undefined,
		canFind: detectedImage !== null,
		selectedTextId: selectedTextLayer?.id ?? null,
	});
	const { mode, textPicker, eyedropper } = modeState;
	const textEditing = useTextEditing({
		document,
		edit: mode.type === "text" ? mode.edit : null,
		dispatchMode,
	});
	const { styledText } = textEditing;
	const cropping = mode.type === "crop";
	const keysTaken = takesKeys(mode);
	const layersOpen = modeState.sheet === "layers";
	const addOpen = modeState.sheet === "add";
	const savedStickers = useSavedStickers();
	const stickerSave = useStickerSave(savedStickers.save);
	const windowWidth = useWindowDimensions().width;
	const layersBeside = windowWidth >= SIDEBAR_MIN_WIDTH;
	const wide = windowWidth >= INSPECTOR_MIN_WIDTH;
	// While typing, the dock rides the keyboard, bringing the text's style
	// and Done, and the document fits above them.
	const stageRef = useRef<View>(null);
	const keyboardOverlap = useKeyboardOverlap(
		stageRef,
		textEditing.edit !== null,
	);
	const barInset = useDockInset(keyboardOverlap);
	// As an inspector, the dock covers none of the canvas's bottom.
	const dockInset = wide ? 0 : barInset;
	// An open tray's height: the canvas fits above it as well as the dock.
	const [trayHeight, setTrayHeight] = useState(0);
	// The tool in the dock. While drawing, strokes on the canvas go into the
	// selected drawing, or a new one; while redacting, into the selected
	// brushed redaction, or a new one. While finding, taps on the canvas pick
	// what's found. While adjusting, the canvas holds still. A tap away from
	// what the tool works on puts it down, as Done does.
	const tool = mode.type === "tool" ? mode.tool : null;
	const toolOptionsOpen =
		mode.type === "tool" && mode.tool !== "adjust" && mode.optionsOpen;
	const adjustedLayer =
		mode.type === "tool" && mode.tool === "adjust"
			? adjustableImage(document, mode.layerId)
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
	const find = useFindTool(document, detectedImage);
	const canvasTool = useMemo((): CanvasTool | null => {
		if (eyedropper) return { type: "pickColor" };
		if (tool === "draw" && draw.settings.tool === "shape") {
			return {
				type: "drawShape",
				shape: draw.settings.shape,
				style: shapeStyleFor(draw.settings, documentSize),
			};
		}
		if (tool === "draw") {
			return { type: "draw", brush: brushFor(draw.settings, documentSize) };
		}
		if (tool !== "redact") return null;
		const effect = redactionEffect(redact.settings, documentSize);
		const brush = maskBrush(redact.settings, documentSize);
		return brush
			? { type: "redactBrush", brush, effect }
			: { type: "redactBox", effect };
	}, [eyedropper, tool, draw.settings, redact.settings, documentSize]);
	const handlePaintStroke = (points: number[]) => {
		if (canvasTool?.type === "draw") {
			drawStroke({ ...canvasTool.brush, points });
		} else if (canvasTool?.type === "redactBrush") {
			paintRedaction({ ...canvasTool.brush, points }, canvasTool.effect);
		}
	};
	// A picked color becomes the custom color too, unless a swatch already
	// has it. Where the canvas shows nothing, it keeps waiting for a tap.
	const handlePickPoint = async (point: Point) => {
		const target = eyedropper;
		if (!target) return;
		const color = await sampleColor(document, point).catch(() => null);
		if (!color) return;
		target.apply(color);
		if (isCustomColor(color)) setCustomColor(color);
		dispatchMode({ type: "stopEyedropper", eyedropper: target });
	};
	const handleDrawBox = (rect: Rect) => {
		if (canvasTool?.type === "redactBox") {
			addRedactionBox(rect, canvasTool.effect);
		}
	};
	const handleDrawShape = (placement: ShapePlacement) => {
		if (canvasTool?.type === "drawShape") {
			addShape(canvasTool.shape, placement, canvasTool.style);
		}
	};

	const { error: autosaveError, retry: retryAutosave } = useAutosave(
		projectId,
		document,
		latestDocument,
	);
	const saveProblem =
		projectId === null
			? "This project couldn't be saved, so your edits won't be kept."
			: autosaveError;

	const selectedIndex = selectedLayer
		? document.layers.indexOf(selectedLayer)
		: -1;
	const moveSelected = (step: 1 | -1) => {
		if (!selectedLayer) return;
		moveLayer(selectedLayer.id, selectedIndex + step);
	};
	const arrangeSelected = (move: ArrangeMove) => {
		if (!selectedLayer) return;
		if (move === "forward") moveSelected(1);
		else if (move === "backward") moveSelected(-1);
		else {
			moveLayer(
				selectedLayer.id,
				move === "front" ? document.layers.length - 1 : 0,
			);
		}
	};

	const startDrawing = () => {
		draw.chooseTool();
		dispatchMode({ type: "startTool", tool: "draw" });
	};
	const startRedacting = () => {
		redact.chooseTool();
		dispatchMode({ type: "startTool", tool: "redact" });
	};
	// The selected image, or else the photo, if there's an image at all.
	const adjustable = adjustTarget(document, selectedLayer);
	const startAdjusting = () => {
		if (!adjustable) return;
		dispatchMode({ type: "startAdjust", layerId: adjustable.id });
	};
	const finishTool = () => {
		dispatchMode({ type: "endTool" });
		find.reset();
	};
	const cancelTool = () => {
		cancelSession();
		finishTool();
	};
	// The selected photo, or else the main one, like Find.
	const cutOut = useCutOut({
		projectId,
		// The mask moves into the project, so autosave knows its file.
		keep: async (uri) =>
			projectId === null ? uri : addImage(projectId, uri, false),
	});
	const cutOutTarget = cutOut ? detectedImage : null;
	const cutOutState: CutOutState | undefined = !cutOutTarget
		? undefined
		: cutOut?.cutting === cutOutTarget.id
			? "cutting"
			: cutOutTarget.mask !== undefined
				? "cut"
				: "whole";
	const toggleCutOut = () => {
		if (cutOut && cutOutTarget) void cutOut.toggle(cutOutTarget);
	};
	// In the selected photo, or else the main one.
	const startFinding = () => {
		if (!detectedImage) return;
		dispatchMode({ type: "startTool", tool: "find" });
	};
	// Done redacts the regions chosen in the style last picked, rather than a
	// selected redaction's.
	const finishFinding = () => {
		find.redactChosen(redactionEffect(redact.chosen, documentSize));
		finishTool();
	};
	const doneWithTool = tool === "find" ? finishFinding : finishTool;

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
	const closeAdd = useCallback(
		() => dispatchMode({ type: "closeAdd" }),
		[dispatchMode],
	);
	const openAdd = () => dispatchMode({ type: "openAdd" });

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
			case "closeAdd":
			case "stopEyedropper":
				dispatchMode({ type: command.type });
				break;
			case "undo":
				undo();
				break;
			case "redo":
				redo();
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
				if (selectedLayer) deleteLayer(selectedLayer.id);
				break;
			case "deselect":
				selectLayer(null);
				break;
			case "duplicate":
				duplicateSelectedLayer();
				break;
			case "reorder":
				moveSelected(command.step);
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

	const panelKind = tool
		? tool
		: styledText
			? "text"
			: selectedLayer
				? "layer"
				: "tools";

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

	// What each tool's key picks up, as its button in the dock would. A
	// selected drawing or redaction takes the strokes, as its own Draw or
	// Redact does.
	const startTool: Record<ToolKey, () => void> = {
		text: startNewText,
		draw: startDrawing,
		redact: startRedacting,
		find: startFinding,
		add: openAdd,
		photo: pickPhoto,
		crop: startCrop,
		adjust: startAdjusting,
		cutOut: toggleCutOut,
	};

	const layerList = {
		layers: document.layers,
		groups: document.groups ?? [],
		background: document.background,
		selectedLayerId: selectedLayer?.id ?? null,
		onSelect: (id: string) => {
			textEditing.finish();
			selectLayer(id);
		},
		onMove: moveLayer,
		onSetHidden: setLayerHidden,
		onSetLocked: setLayerLocked,
		onDelete: deleteLayer,
		onSetGroupHidden: setLayerGroupHidden,
		onSetGroupLocked: setLayerGroupLocked,
		onDeleteGroup: deleteLayerGroup,
		onSetBackground: setBackground,
		onClose: closeLayers,
		bottomInset: dockInset,
	};
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
		if (textEditing.edit) textEditing.finish();
		start();
	};

	return (
		<TrayHeight.Provider value={setTrayHeight}>
			<TrayPlacement.Provider value={wide ? INSPECTOR_TRAY : null}>
				<View style={styles.container}>
					<ScreenHeader
						backLabel="Back to projects"
						onBack={tool ? undefined : () => leaveEditor(router)}
						action={
							<View style={styles.headerActions}>
								{adjustedLayer?.adjustments && (
									<TextButton
										label="Reset"
										onPress={() =>
											setAdjustments(adjustedLayer.id, neutralAdjustments)
										}
									/>
								)}
								{/* A wide screen's inspector always shows them. */}
								{!tool && !wide && (
									<IconButton
										icon="layers-outline"
										label="Layers"
										shortcut={LAYERS_KEY}
										selected={layersOpen}
										onPress={() => dispatchMode({ type: "toggleLayers" })}
									/>
								)}
								<IconButton
									icon="arrow-undo-outline"
									label="Undo"
									shortcut="mod+Z"
									disabled={!canUndo}
									onPress={undo}
								/>
								<IconButton
									icon="arrow-redo-outline"
									label="Redo"
									shortcut="mod+shift+Z"
									disabled={!canRedo}
									onPress={redo}
								/>
								{!tool && (
									<View style={styles.exportAction}>
										<Button
											label="Export"
											icon="share-outline"
											variant="primary"
											size="small"
											onPress={() => router.push(exportHref(projectId))}
										/>
									</View>
								)}
							</View>
						}
					/>
					{/* The dock covers the stage's bottom, which runs under it. */}
					<CanvasStage ref={stageRef} toBottom>
						<EditorCanvas
							ref={canvasRef}
							document={document}
							selectedLayer={selectedLayer}
							textEdit={textEditing.edit}
							onTextSelect={textEditing.select}
							onTextEditDone={textEditing.finish}
							onSelectLayer={selectLayer}
							onTapSelectedLayer={
								selectedTextLayer
									? (point) =>
											textEditing.editSelected(
												textIndexAt(
													selectedTextLayer,
													toLayerSpace(selectedTextLayer.transform, point),
												),
											)
									: undefined
							}
							onCommitTransform={transformLayer}
							onResizeBox={resizeBox}
							onNudgeLayer={nudgeLayer}
							tool={canvasTool}
							detection={
								tool === "find" && detectedImage && !eyedropper
									? {
											regions: find.overlay,
											imageId: detectedImage.id,
											onToggle: find.toggle,
										}
									: null
							}
							onPaintStroke={handlePaintStroke}
							onDrawBox={handleDrawBox}
							onDrawShape={handleDrawShape}
							onPickPoint={handlePickPoint}
							onToolInteractionEnd={() =>
								dispatchMode({ type: "closeToolOptions" })
							}
							onTapAway={doneWithTool}
							adjusting={adjusting}
							bottomInset={wide ? 0 : dockInset + trayHeight}
							leftInset={wide ? RAIL_WIDTH : 0}
							rightInset={wide ? INSPECTOR_WIDTH : 0}
							selectionBar={
								selectedLayer && (
									<SelectionBar
										canMoveForward={selectedIndex < document.layers.length - 1}
										canMoveBackward={selectedIndex > 0}
										onEdit={
											selectedTextLayer
												? () => textEditing.editSelected()
												: undefined
										}
										stretched={selectedLayer.resizable === true}
										onToggleStretch={
											selectedLayer.type === "text" ||
											selectedLayer.type === "image"
												? () =>
														setLayerResizable(
															selectedLayer.id,
															!selectedLayer.resizable,
														)
												: undefined
										}
										onArrange={arrangeSelected}
										onDuplicate={duplicateSelectedLayer}
										onDelete={() => deleteLayer(selectedLayer.id)}
									/>
								)
							}
						/>
						{wide && <InspectorBackdrop />}
						{tool === "draw" && toolOptionsOpen && (
							<BrushOptions
								settings={draw.settings}
								customColor={customColor}
								bottomInset={dockInset}
								onChange={draw.change}
								onPickCustom={(color) => {
									draw.change({ ...draw.settings, color });
									setCustomColor(color);
								}}
								onEyedropper={() => {
									dispatchMode({
										type: "startEyedropper",
										eyedropper: {
											apply: (color) =>
												draw.change({ ...draw.settings, color }),
										},
									});
								}}
								onClose={() => dispatchMode({ type: "closeToolOptions" })}
							/>
						)}
						{tool === "redact" && toolOptionsOpen && (
							<RedactOptions
								settings={redact.settings}
								customColor={customColor}
								bottomInset={dockInset}
								onChange={redact.change}
								onPickCustom={(color) => {
									redact.change({ ...redact.settings, color });
									setCustomColor(color);
								}}
								onEyedropper={() => {
									dispatchMode({
										type: "startEyedropper",
										eyedropper: {
											apply: (color) =>
												redact.change({ ...redact.settings, color }),
										},
									});
								}}
								onClose={() => dispatchMode({ type: "closeToolOptions" })}
							/>
						)}
						{tool === "find" && toolOptionsOpen && (
							<RedactOptions
								settings={{ ...redact.chosen, tool: "box" }}
								customColor={customColor}
								bottomInset={dockInset}
								onChange={({ tool: _, ...style }) =>
									redact.setChosen((settings) => ({ ...settings, ...style }))
								}
								onPickCustom={(color) => {
									redact.setChosen((settings) => ({ ...settings, color }));
									setCustomColor(color);
								}}
								onEyedropper={() => {
									dispatchMode({
										type: "startEyedropper",
										eyedropper: {
											apply: (color) =>
												redact.setChosen((settings) => ({
													...settings,
													color,
												})),
										},
									});
								}}
								onClose={() => dispatchMode({ type: "closeToolOptions" })}
							/>
						)}
						{tool === "find" && !toolOptionsOpen && !eyedropper && (
							<DetectionOptions
								state={find.state}
								visibleIndices={find.visibleIndices}
								selectedCount={find.selectedCount}
								bottomInset={dockInset}
								onRetry={find.retry}
								onStop={find.reset}
								onSelectAll={find.selectAll}
								onClear={find.clear}
								onApply={finishFinding}
							/>
						)}
						{textPicker && styledText && (
							<TextColorPicker
								layer={styledText}
								colorKey={textPicker.key}
								bottomInset={dockInset}
								onChange={textEditing.style}
								onPickCustom={setCustomColor}
								onEyedropper={() => {
									const { key } = textPicker;
									dispatchMode({
										type: "startEyedropper",
										eyedropper: {
											apply: (color) => textEditing.style({ [key]: color }),
										},
									});
								}}
								onClose={() => dispatchMode({ type: "closeTextPicker" })}
							/>
						)}
						{eyedropper && (
							<EyedropperHint
								onCancel={() => dispatchMode({ type: "stopEyedropper" })}
							/>
						)}
						{saveProblem && (
							<SaveErrorBanner
								message={saveProblem}
								onRetry={projectId !== null ? retryAutosave : undefined}
								rightInset={
									wide
										? INSPECTOR_WIDTH
										: layersBeside && layersOpen
											? LAYERS_SIDEBAR_INSET
											: undefined
								}
							/>
						)}
						{layersBeside && !wide && layersPanel}
						{wide && (
							<View style={styles.rail}>
								<ToolsPanel
									vertical
									tool={textEditing.edit ? "text" : tool}
									addBusy={addBusy}
									onAddText={fromRail(startNewText)}
									onDraw={fromRail(startDrawing)}
									onRedact={fromRail(startRedacting)}
									onFind={detectedImage ? fromRail(startFinding) : undefined}
									onAdd={fromRail(openAdd)}
									onCrop={fromRail(startCrop)}
									onAdjust={adjustable ? fromRail(startAdjusting) : undefined}
									cutOut={cutOutState}
									onCutOut={fromRail(toggleCutOut)}
								/>
							</View>
						)}

						{/* After the tool's options, so taps on the dock reach it rather
				    than closing them. */}
						<Dock
							panel={panelKind}
							layout={wide ? "inspector" : "bar"}
							footer={
								tool ? (
									<DockFooter
										title={TOOL_TITLES[tool]}
										onCancel={cancelTool}
										onDone={doneWithTool}
										doneShortcut="Escape"
									/>
								) : textEditing.edit ? (
									<DockFooter
										title="Text"
										onCancel={() => dispatchMode({ type: "endText" })}
										onDone={textEditing.finish}
										doneShortcut="Escape"
									/>
								) : selectedLayer ? (
									<DockFooter
										title={layerKindName(selectedLayer)}
										onDone={() => selectLayer(null)}
										doneShortcut="Escape"
									/>
								) : undefined
							}
							keyboardOverlap={keyboardOverlap}
						>
							{tool === "draw" ? (
								<DrawPanel
									settings={draw.settings}
									optionsOpen={toolOptionsOpen}
									onChange={draw.change}
									onToggleOptions={() =>
										dispatchMode({ type: "toggleToolOptions" })
									}
								/>
							) : tool === "adjust" ? (
								<AdjustPanel
									controller={adjustController}
									adjustments={adjustedLayer?.adjustments}
								/>
							) : tool === "redact" ? (
								<RedactPanel
									settings={redact.settings}
									optionsOpen={toolOptionsOpen}
									onChange={redact.change}
									onToggleOptions={() =>
										dispatchMode({ type: "toggleToolOptions" })
									}
								/>
							) : tool === "find" ? (
								<FindPanel
									state={find.state}
									settings={redact.chosen}
									optionsOpen={toolOptionsOpen}
									onFind={find.find}
									onToggleOptions={() =>
										dispatchMode({ type: "toggleToolOptions" })
									}
								/>
							) : styledText ? (
								<TextStylePanel
									layer={styledText}
									customColor={customColor}
									onChange={textEditing.style}
									onOpenPicker={(key) =>
										dispatchMode({
											type: "openTextPicker",
											layerId: styledText.id,
											key,
										})
									}
								/>
							) : selectedLayer ? (
								<LayerActionsPanel
									onDraw={
										selectedLayer.type === "drawing" ||
										selectedLayer.type === "shape"
											? startDrawing
											: undefined
									}
									onRedact={
										selectedLayer.type === "redaction" ||
										selectedLayer.type === "image"
											? startRedacting
											: undefined
									}
									onAdjust={
										selectedLayer.type === "image" ? startAdjusting : undefined
									}
									onFind={
										selectedLayer.type === "image" && !selectedLayer.hidden
											? startFinding
											: undefined
									}
									cutOut={
										cutOutTarget === selectedLayer ? cutOutState : undefined
									}
									onCutOut={toggleCutOut}
									sticker={stickerSave.status}
									onSaveSticker={stickerSave.save}
								/>
							) : wide ? (
								<LayersPanel {...layerList} layout="inspector" open />
							) : (
								<ToolsPanel
									addBusy={addBusy}
									onAddText={startNewText}
									onDraw={startDrawing}
									onRedact={startRedacting}
									onFind={detectedImage ? startFinding : undefined}
									onAdd={openAdd}
									onCrop={startCrop}
									onAdjust={adjustable ? startAdjusting : undefined}
									cutOut={cutOutState}
									onCutOut={toggleCutOut}
								/>
							)}
						</Dock>
					</CanvasStage>
					{!layersBeside && layersPanel}
					<AddSheet
						open={addOpen}
						onClose={closeAdd}
						onAddPhoto={() => {
							closeAdd();
							pickPhoto();
						}}
						onAddSticker={(sticker) => {
							closeAdd();
							addSticker(() => bundledStickerImage(sticker));
						}}
						savedStickers={savedStickers.stickers}
						savedError={savedStickers.error}
						onAddSaved={(sticker) => {
							closeAdd();
							addSticker(() => savedStickers.place(sticker));
						}}
						// Kept, then added at once, as it was picked to use.
						onSaveNew={() => {
							closeAdd();
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
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	exportAction: {
		marginLeft: 6,
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
