import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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
import type { CanvasInput } from "@/features/editor/canvas/canvasInput";
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
	type EditorModeAction,
	type EditorModeState,
	type EditorTool,
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
import {
	type EditorActions,
	useEditorActions,
} from "@/features/editor/useEditorActions";
import { useEditorMode } from "@/features/editor/useEditorMode";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { useStickerSave } from "@/features/editor/useStickerSave";
import { textIndexAt } from "@/layers/textLayerLayout";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { errorMessage } from "@/lib/errorMessage";
import { usePreference } from "@/lib/usePreference";
import { type Adjustments, neutralAdjustments } from "@/model/adjustments";
import {
	type EditorDocument,
	type ImageLayer,
	type Layer,
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

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
type DockPanel = EditorTool | "text" | "layer" | "idle";

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
	const {
		addImageLayer,
		addStickerLayer,
		duplicateSelectedLayer,
		drawStroke,
		addRedactionBox,
		setLayerGroupHidden,
		setLayerGroupLocked,
		deleteLayerGroup,
		paintRedaction,
		addShape,
		setAdjustments,
		transformLayer,
		resizeBox,
		nudgeLayer,
		moveLayer,
		setLayerHidden,
		setLayerLocked,
		setLayerResizable,
		setBackground,
		reframe,
		deleteLayer,
		selectLayer,
		undo,
		redo,
		beginSession,
		commitSession,
		cancelSession,
	} = useEditorActions();

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
	const { mode, eyedropper } = modeState;
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
	// What input on the canvas does: the eyedropper's or a painting tool's,
	// then Find's taps, Adjust's stillness, typing, or else selecting.
	const editingText = textEditing.edit !== null;
	const canvasInput = useMemo((): CanvasInput => {
		if (canvasTool) return { type: "tool", tool: canvasTool };
		if (tool === "find" && detectedImage) {
			return {
				type: "find",
				imageId: detectedImage.id,
				onToggle: find.toggle,
			};
		}
		if (tool === "adjust") return { type: "adjust" };
		if (editingText) return { type: "editText" };
		return { type: "select" };
	}, [canvasTool, tool, detectedImage, find.toggle, editingText]);
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

	const layerList = layerListProps({
		document,
		selectedLayer,
		actions: {
			selectLayer,
			moveLayer,
			setLayerHidden,
			setLayerLocked,
			deleteLayer,
			setLayerGroupHidden,
			setLayerGroupLocked,
			deleteLayerGroup,
			setBackground,
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
		if (textEditing.edit) textEditing.finish();
		start();
	};
	// The tools' buttons, for the dock and, through `fromRail`, the rail.
	const toolStarters: ToolStarters = {
		addBusy,
		cutOut: cutOutState,
		onAddText: startNewText,
		onDraw: startDrawing,
		onRedact: startRedacting,
		onSticker: openAdd,
		onPhoto: pickPhoto,
		onCrop: startCrop,
		onAdjust: adjustable ? startAdjusting : undefined,
		onCutOut: toggleCutOut,
	};
	// What the dock offers for the selected layer, by its kind.
	const layerActions =
		selectedLayer &&
		layerActionsFor({
			layer: selectedLayer,
			onDraw: startDrawing,
			onRedact: startRedacting,
			onAdjust: startAdjusting,
			onFind: startFinding,
			cutOut: cutOutTarget === selectedLayer ? cutOutState : undefined,
			onCutOut: toggleCutOut,
			sticker: stickerSave.status,
			onSaveSticker: stickerSave.save,
		});

	return (
		<TrayHeight.Provider value={setTrayHeight}>
			<TrayPlacement.Provider value={wide ? INSPECTOR_TRAY : null}>
				<View style={styles.container}>
					{/* Back and Export stay through every tool: leaving keeps the
					    tool's changes, as the browser's own Back does. */}
					<ScreenHeader
						backLabel="Back to projects"
						onBack={() => leaveEditor(router)}
						action={
							<HeaderActions
								onReset={
									adjustedLayer?.adjustments
										? () => setAdjustments(adjustedLayer.id, neutralAdjustments)
										: undefined
								}
								// A wide screen's inspector always shows the layers.
								layers={
									!tool && !wide
										? {
												open: layersOpen,
												onToggle: () => dispatchMode({ type: "toggleLayers" }),
											}
										: undefined
								}
								onExport={() => router.push(exportHref(projectId))}
							/>
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
							input={canvasInput}
							detections={
								tool === "find" && !eyedropper ? find.overlay : undefined
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
						<ToolTrays
							modeState={modeState}
							dispatchMode={dispatchMode}
							draw={draw}
							redact={redact}
							find={find}
							textEditing={textEditing}
							customColor={customColor}
							onCustomColor={setCustomColor}
							bottomInset={dockInset}
						/>
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
									{...toolButtonsFor(toolStarters, fromRail)}
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
										onCancel={cancelWithTool}
										onDone={doneWithTool}
										doneLabel={
											tool === "find" && find.selectedCount > 0
												? `Redact ${find.selectedCount} selected`
												: undefined
										}
										doneShortcut="Escape"
									/>
								) : textEditing.edit ? (
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
								) : undefined
							}
							keyboardOverlap={keyboardOverlap}
						>
							<DockContent
								panel={panelKind}
								optionsOpen={toolOptionsOpen}
								onFind={detectedImage ? startFinding : undefined}
								dispatchMode={dispatchMode}
								draw={draw}
								redact={redact}
								find={find}
								adjustController={adjustController}
								adjustments={adjustedLayer?.adjustments}
								textEditing={textEditing}
								customColor={customColor}
								layerActions={layerActions}
								idle={
									wide ? (
										<LayersPanel {...layerList} layout="inspector" open />
									) : (
										<ToolsPanel {...toolButtonsFor(toolStarters)} />
									)
								}
							/>
						</Dock>
					</CanvasStage>
					{!layersBeside && layersPanel}
					<AddSheet
						open={addOpen}
						onClose={closeAdd}
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

/** The store actions the layers panel uses. */
type LayerListActions = Pick<
	EditorActions,
	| "selectLayer"
	| "moveLayer"
	| "setLayerHidden"
	| "setLayerLocked"
	| "deleteLayer"
	| "setLayerGroupHidden"
	| "setLayerGroupLocked"
	| "deleteLayerGroup"
	| "setBackground"
>;

/**
 * The layers panel's props, from the document, the selection, and the store.
 * Picking a layer ends any text being edited first.
 */
function layerListProps({
	document,
	selectedLayer,
	actions,
	onFinishText,
	onClose,
	bottomInset,
}: {
	document: EditorDocument;
	selectedLayer: Layer | undefined;
	actions: LayerListActions;
	onFinishText: () => void;
	onClose: () => void;
	bottomInset: number;
}) {
	return {
		layers: document.layers,
		groups: document.groups ?? [],
		background: document.background,
		selectedLayerId: selectedLayer?.id ?? null,
		onSelect: (id: string) => {
			onFinishText();
			actions.selectLayer(id);
		},
		onMove: actions.moveLayer,
		onSetHidden: actions.setLayerHidden,
		onSetLocked: actions.setLayerLocked,
		onDelete: actions.deleteLayer,
		onSetGroupHidden: actions.setLayerGroupHidden,
		onSetGroupLocked: actions.setLayerGroupLocked,
		onDeleteGroup: actions.deleteLayerGroup,
		onSetBackground: actions.setBackground,
		onClose,
		bottomInset,
	};
}

/** What picking each tool does, before `wrap` adapts it for its place. */
type ToolStarters = {
	addBusy: boolean;
	cutOut: CutOutState | undefined;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onSticker: () => void;
	onPhoto: () => void;
	onCrop: () => void;
	onAdjust: (() => void) | undefined;
	onCutOut: () => void;
};

/** The tools' buttons' props: each starter through `wrap` (see `fromRail`). */
function toolButtonsFor(
	starters: ToolStarters,
	wrap: (start: () => void) => () => void = (start) => start,
) {
	return {
		addBusy: starters.addBusy,
		cutOut: starters.cutOut,
		onAddText: wrap(starters.onAddText),
		onDraw: wrap(starters.onDraw),
		onRedact: wrap(starters.onRedact),
		onSticker: wrap(starters.onSticker),
		onPhoto: wrap(starters.onPhoto),
		onCrop: wrap(starters.onCrop),
		onAdjust:
			starters.onAdjust === undefined ? undefined : wrap(starters.onAdjust),
		onCutOut: wrap(starters.onCutOut),
	};
}

/** What the dock offers for `layer`, by its kind. */
function layerActionsFor({
	layer,
	onDraw,
	onRedact,
	onAdjust,
	onFind,
	cutOut,
	onCutOut,
	sticker,
	onSaveSticker,
}: {
	layer: Layer;
	onDraw: () => void;
	onRedact: () => void;
	onAdjust: () => void;
	onFind: () => void;
	cutOut: CutOutState | undefined;
	onCutOut: () => void;
	sticker: "saving" | "saved" | undefined;
	onSaveSticker: (() => void) | undefined;
}) {
	return {
		onDraw:
			layer.type === "drawing" || layer.type === "shape" ? onDraw : undefined,
		onRedact:
			layer.type === "redaction" || layer.type === "image"
				? onRedact
				: undefined,
		onAdjust: layer.type === "image" ? onAdjust : undefined,
		onFind: layer.type === "image" && !layer.hidden ? onFind : undefined,
		cutOut,
		onCutOut,
		sticker,
		onSaveSticker,
	};
}

/**
 * The header's actions: Reset while the image being adjusted has changes,
 * the layers where the inspector doesn't show them, undo and redo, and
 * Export.
 */
function HeaderActions({
	onReset,
	layers,
	onExport,
}: {
	onReset?: () => void;
	layers?: { open: boolean; onToggle: () => void };
	onExport: () => void;
}) {
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const { undo, redo } = useEditorActions();
	return (
		<View style={styles.headerActions}>
			{onReset && <TextButton label="Reset" onPress={onReset} />}
			{layers && (
				<IconButton
					icon="layers-outline"
					label="Layers"
					shortcut={LAYERS_KEY}
					selected={layers.open}
					onPress={layers.onToggle}
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
			<View style={styles.exportAction}>
				<Button
					label="Export"
					icon="share-outline"
					variant="primary"
					size="small"
					onPress={onExport}
				/>
			</View>
		</View>
	);
}

type ModeProps = {
	dispatchMode: (action: EditorModeAction<TextEditing>) => void;
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	textEditing: ReturnType<typeof useTextEditing>;
	customColor: string | null;
};

/**
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
function ToolTrays({
	modeState,
	dispatchMode,
	draw,
	redact,
	find,
	textEditing,
	customColor,
	onCustomColor,
	bottomInset,
}: ModeProps & {
	modeState: EditorModeState<TextEditing>;
	onCustomColor: (color: string) => void;
	bottomInset: number;
}) {
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = textEditing;
	const tray =
		mode.type === "tool" && mode.tool !== "adjust" && mode.optionsOpen
			? mode.tool
			: null;
	const closeTray = () => dispatchMode({ type: "closeToolOptions" });
	// For a tray whose colors go to `apply`: a color from its picker, which
	// becomes the custom color too, and the eyedropper, for a color from the
	// canvas.
	const colorTarget = (apply: (color: string) => void) => ({
		onPickCustom: (color: string) => {
			apply(color);
			onCustomColor(color);
		},
		onEyedropper: () =>
			dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
	});
	return (
		<>
			{tray === "draw" && (
				<BrushOptions
					settings={draw.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={draw.change}
					{...colorTarget((color) => draw.change({ ...draw.settings, color }))}
					onClose={closeTray}
				/>
			)}
			{tray === "redact" && (
				<RedactOptions
					settings={redact.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={redact.change}
					{...colorTarget((color) =>
						redact.change({ ...redact.settings, color }),
					)}
					onClose={closeTray}
				/>
			)}
			{tray === "find" && (
				<RedactOptions
					settings={{ ...redact.chosen, tool: "box" }}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={({ tool: _, ...style }) =>
						redact.setChosen((settings) => ({ ...settings, ...style }))
					}
					{...colorTarget((color) =>
						redact.setChosen((settings) => ({ ...settings, color })),
					)}
					onClose={closeTray}
				/>
			)}
			{mode.type === "tool" && mode.tool === "find" && !tray && !eyedropper && (
				<DetectionOptions
					state={find.state}
					visibleIndices={find.visibleIndices}
					selectedCount={find.selectedCount}
					bottomInset={bottomInset}
					onRetry={find.retry}
					onStop={find.reset}
					onSelectAll={find.selectAll}
					onClear={find.clear}
				/>
			)}
			{textPicker && styledText && (
				<TextColorPicker
					layer={styledText}
					colorKey={textPicker.key}
					bottomInset={bottomInset}
					{...colorTarget((color) =>
						textEditing.style({ [textPicker.key]: color }),
					)}
					onClose={() => dispatchMode({ type: "closeTextPicker" })}
				/>
			)}
			{eyedropper && (
				<EyedropperHint
					onCancel={() => dispatchMode({ type: "stopEyedropper" })}
				/>
			)}
		</>
	);
}

/**
 * What the dock holds: the open tool's panel, the style of the text being
 * typed or selected, the selected layer's actions, or else `idle`.
 */
function DockContent({
	panel,
	optionsOpen,
	dispatchMode,
	draw,
	redact,
	find,
	adjustController,
	adjustments,
	textEditing,
	customColor,
	layerActions,
	idle,
	onFind,
}: ModeProps & {
	panel: DockPanel;
	optionsOpen: boolean;
	onFind: (() => void) | undefined;
	adjustController: ReturnType<typeof useAdjustController>;
	adjustments: Adjustments | undefined;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	idle: ReactNode;
}) {
	const toggleOptions = () => dispatchMode({ type: "toggleToolOptions" });
	const { styledText } = textEditing;
	switch (panel) {
		case "draw":
			return (
				<DrawPanel
					settings={draw.settings}
					optionsOpen={optionsOpen}
					onChange={draw.change}
					onToggleOptions={toggleOptions}
				/>
			);
		case "redact":
			return (
				<RedactPanel
					settings={redact.settings}
					optionsOpen={optionsOpen}
					onChange={redact.change}
					onToggleOptions={toggleOptions}
					onFind={onFind}
				/>
			);
		case "find":
			return (
				<FindPanel
					state={find.state}
					settings={redact.chosen}
					optionsOpen={optionsOpen}
					onFind={find.find}
					onToggleOptions={toggleOptions}
				/>
			);
		case "adjust":
			return (
				<AdjustPanel controller={adjustController} adjustments={adjustments} />
			);
		case "text":
			return (
				styledText && (
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
				)
			);
		case "layer":
			return layerActions && <LayerActionsPanel {...layerActions} />;
		case "idle":
			return idle;
	}
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
