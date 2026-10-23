import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { errorMessage } from "@/lib/errorMessage";
import { neutralAdjustments } from "@/model/adjustments";
import { imagePointAt, isCutOut } from "@/model/cutout";
import {
	type EditorDocument,
	maxNewImageShortSide,
	type ShapePlacement,
} from "@/model/document";
import {
	type Framing,
	targetImageLayer,
	visibleImageLayer,
} from "@/model/framing";
import { type Point, type Rect, toLayerSpace } from "@/model/geometry";
import { usePreference } from "@/platform/usePreference";
import { projectLabel } from "@/projects/projectFile";
import { exportHref } from "@/projects/projectRoute";
import { addImage, openProjectName } from "@/projects/projectService";
import { sampleColor } from "@/render/renderDocument";
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
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import type { CanvasInput, CanvasTool } from "./canvas/canvasInput";
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
import { isCustomColor } from "./shell/ColorSwatches";
import {
	Dock,
	DockFooter,
	INSPECTOR_TRAY_TOP,
	INSPECTOR_WIDTH,
	InspectorBackdrop,
	useDockInset,
} from "./shell/Dock";
import type { DialDrag } from "./shell/dialDrag";
import { type ArrangeMove, SelectionBar } from "./shell/SelectionBar";
import { TrayHeight, TrayPlacement } from "./shell/ToolOptions";
import { ToolsPanel } from "./shell/ToolsPanel";
import type { Shortcut, ToolKey } from "./shortcuts";
import {
	ADJUST_DIAL_MAX,
	ADJUST_DIAL_SCALE,
	useAdjustController,
} from "./tools/adjust/useAdjustController";
import { CropTool } from "./tools/crop/CropTool";
import {
	cutBrush,
	cutOutTool,
	parseCutOutSettings,
} from "./tools/cutout/cutOutSettings";
import { useCutOut } from "./tools/cutout/useCutOut";
import { useCutRedaction } from "./tools/cutout/useCutRedaction";
import { brushFor, shapeStyleFor } from "./tools/draw/brushSettings";
import { useDrawTool } from "./tools/draw/useDrawTool";
import { useFindTool } from "./tools/find/useFindTool";
import { layerKindName } from "./tools/layers/LayerRow";
import { LAYERS_SIDEBAR_INSET, LayersPanel } from "./tools/layers/LayersPanel";
import { maskBrush, redactionEffect } from "./tools/redact/redactSettings";
import { useRedactTool } from "./tools/redact/useRedactTool";
import { StickerSheet } from "./tools/stickers/StickerSheet";
import { bundledStickerImage } from "./tools/stickers/stickerFile";
import { useSavedStickers } from "./tools/stickers/useSavedStickers";
import { useStickerSave } from "./tools/stickers/useStickerSave";
import { TextEditor } from "./tools/text/TextEditor";
import { type TextEditing, useTextEditing } from "./tools/text/useTextEditing";
import { useAddImage } from "./useAddImage";
import { useDeleteNotice } from "./useDeleteNotice";
import { useEditorActions } from "./useEditorActions";
import { useEditorMode } from "./useEditorMode";
import { useEditorShortcuts } from "./useEditorShortcuts";

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
	const {
		addImageLayer,
		addStickerLayer,
		duplicateSelectedLayer,
		drawStroke,
		addRedactionBox,
		addMaskedRedaction,
		setLayerGroupHidden,
		setLayerGroupLocked,
		deleteLayerGroup,
		paintRedaction,
		addShape,
		setAdjustments,
		setMask,
		invertMask,
		paintMask,
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
	const cropping = mode.type === "crop";
	const keysTaken = takesKeys(mode);
	const layersOpen = modeState.sheet === "layers";
	const stickersOpen = modeState.sheet === "stickers";
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
	// A mask found after Cut out was put down, or moved to another image,
	// isn't wanted any more.
	const cutLayerId = useRef<string | null>(null);
	cutLayerId.current = cutLayer?.id ?? null;
	const [cutSettings, setCutSettings] = usePreference(
		"cutOut",
		parseCutOutSettings,
	);
	const cutOut = useCutOut({
		projectId,
		image: cutLayer,
		picking: cutSettings.tool === "pick",
		latest: (layerId) => {
			const current = latestDocument();
			return current ? visibleImageLayer(current, layerId) : undefined;
		},
		// The mask moves into the project, so autosave knows its file.
		keep: async (uri) =>
			projectId === null ? uri : addImage(projectId, uri, false),
		onMask: (layerId, mask, picked) => {
			if (cutLayerId.current === layerId) {
				setMask(layerId, mask, { keepStrokes: picked });
			}
		},
		onInvert: (layerId, mask) => {
			if (cutLayerId.current === layerId) invertMask(layerId, mask);
		},
	});
	// Redacting the cut's selection puts the image back as it was before
	// Cut out, with a redaction over what was selected, and goes on to
	// Redact to choose how it hides it.
	const cutRedaction = useCutRedaction({
		keep: async (uri) =>
			projectId === null ? uri : addImage(projectId, uri, false),
		onRedact: (layerId, mask, rect) => {
			if (cutLayerId.current !== layerId) return;
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
	const cutTool = cutOutTool(cutSettings, cutOut.canFind);
	const canvasTool = useMemo((): CanvasTool | null => {
		if (eyedropper) return { type: "pickColor" };
		if (cutLayer) {
			const brush = cutBrush(cutSettings, cutTool, documentSize);
			return brush
				? { type: "cutBrush", layerId: cutLayer.id, brush }
				: { type: "pickSubject", layerId: cutLayer.id };
		}
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
	}, [
		eyedropper,
		cutLayer,
		cutSettings,
		cutTool,
		tool,
		draw.settings,
		redact.settings,
		documentSize,
	]);
	// A sideways drag over the photo turns Adjust's dial, as the dial does.
	const { dialValue, begin, change, end } = adjustController;
	const adjustDrag = useMemo(
		(): DialDrag => ({
			value: dialValue,
			scale: ADJUST_DIAL_SCALE,
			max: ADJUST_DIAL_MAX,
			onBegin: begin,
			onChange: change,
			onEnd: end,
		}),
		[dialValue, begin, change, end],
	);
	// What input on the canvas does: the eyedropper's or a painting tool's,
	// then Find's taps, Adjust's stillness, typing, or else selecting.
	const editingText = textEditing.edit !== null;
	const canvasInput = useMemo((): CanvasInput => {
		if (canvasTool) return { type: "tool", tool: canvasTool };
		if (tool === "find" && targetImage) {
			return {
				type: "find",
				imageId: targetImage.id,
				onToggle: find.toggle,
			};
		}
		if (tool === "adjust") return { type: "adjust", drag: adjustDrag };
		if (editingText) return { type: "editText" };
		return { type: "select" };
	}, [canvasTool, tool, targetImage, find.toggle, editingText, adjustDrag]);
	const handlePaintStroke = (points: number[]) => {
		if (canvasTool?.type === "draw") {
			drawStroke({ ...canvasTool.brush, points });
		} else if (canvasTool?.type === "redactBrush") {
			paintRedaction({ ...canvasTool.brush, points }, canvasTool.effect);
		} else if (canvasTool?.type === "cutBrush") {
			paintMask(canvasTool.layerId, { ...canvasTool.brush, points });
		}
	};
	// A tap on the image being cut out cuts out only the subject there.
	const pickSubject = (point: Point) => {
		const at = cutLayer && imagePointAt(cutLayer, point);
		if (cutLayer && at) void cutOut.find(cutLayer, at);
	};
	// A picked color becomes the custom color too, unless a swatch already
	// has it. Where the canvas shows nothing, it keeps waiting for a tap.
	const handlePickPoint = async (point: Point) => {
		if (canvasTool?.type === "pickSubject") {
			pickSubject(point);
			return;
		}
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

	// What home lists the project as: the name it was given, or its text.
	const projectTitle = useMemo(
		() =>
			(projectId !== null && openProjectName(projectId)) ||
			projectLabel(document),
		[projectId, document],
	);

	const deleteNotice = useDeleteNotice(document);
	const deleteWithNotice = (id: string) => {
		const layer = document.layers.find((candidate) => candidate.id === id);
		if (!layer) return;
		deleteNotice.deleted(`${layerKindName(layer)} deleted`, () =>
			deleteLayer(id),
		);
	};
	const deleteGroupWithNotice = (id: string) => {
		const group = document.groups?.find((candidate) => candidate.id === id);
		if (!group) return;
		deleteNotice.deleted(`${group.name} deleted`, () => deleteLayerGroup(id));
	};

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
	// The selected photo, or else the main one, like Find. An image that
	// isn't cut yet has its subjects cut out at once, so one tap still does
	// it; one that is opens to refine its cut.
	const startCutOut = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startCutOut", layerId: targetImage.id });
		if (cutOut.canFind && !isCutOut(targetImage)) {
			cutLayerId.current = targetImage.id;
			void cutOut.find(targetImage);
		}
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
		if (textEditing.edit) textEditing.finish();
		router.push(exportHref(projectId));
	};
	const leave = () => {
		if (textEditing.edit) textEditing.finish();
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
				if (selectedLayer) deleteWithNotice(selectedLayer.id);
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
			selectLayer,
			moveLayer,
			setLayerHidden,
			setLayerLocked,
			deleteLayer: deleteWithNotice,
			setLayerGroupHidden,
			setLayerGroupLocked,
			deleteLayerGroup: deleteGroupWithNotice,
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
		onAddText: startNewText,
		onDraw: startDrawing,
		onRedact: startRedacting,
		onSticker: openStickers,
		onPhoto: pickPhoto,
		onCrop: startCrop,
		onAdjust: targetImage ? startAdjusting : undefined,
		onCutOut: targetImage ? startCutOut : undefined,
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
			onCutOut: startCutOut,
			sticker: stickerSave.status,
			onSaveSticker: stickerSave.save,
		});

	return (
		<TrayHeight.Provider value={setTrayHeight}>
			<TrayPlacement.Provider value={wide ? INSPECTOR_TRAY : null}>
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
								typing={textEditing.edit !== null}
								onReset={
									adjustedLayer?.adjustments
										? () => setAdjustments(adjustedLayer.id, neutralAdjustments)
										: cutLayer && isCutOut(cutLayer)
											? () => setMask(cutLayer.id, null)
											: undefined
								}
								// A wide screen's inspector always shows the layers.
								layers={
									!tool && !textEditing.edit && !wide
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
										onDelete={() => deleteWithNotice(selectedLayer.id)}
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
							cut={{
								settings: cutSettings,
								tool: cutTool,
								onChange: setCutSettings,
							}}
							textEditing={textEditing}
							customColor={customColor}
							onCustomColor={setCustomColor}
							bottomInset={dockInset}
						/>
						<Announcement message={cutOut.news} />
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
								onFind={targetImage ? startFinding : undefined}
								dispatchMode={dispatchMode}
								draw={draw}
								redact={redact}
								find={find}
								cut={{
									settings: cutSettings,
									tool: cutTool,
									onChange: setCutSettings,
									finding: cutOut.finding,
									onFindAll:
										cutOut.canFind && cutLayer
											? () => void cutOut.find(cutLayer)
											: undefined,
									inverting: cutOut.inverting,
									onInvert:
										cutLayer && isCutOut(cutLayer)
											? () => void cutOut.invert(cutLayer)
											: undefined,
									redacting: cutRedaction.busy,
									onRedact:
										cutLayer && isCutOut(cutLayer)
											? () => void cutRedaction.redact(cutLayer)
											: undefined,
								}}
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
					{deleteNotice.message && (
						<Toast
							message={deleteNotice.message}
							action="Undo"
							onAction={deleteNotice.undo}
							inset={{
								left: wide ? RAIL_WIDTH : 0,
								right: wide
									? INSPECTOR_WIDTH
									: layersBeside && layersOpen
										? LAYERS_SIDEBAR_INSET
										: 0,
								bottom: dockInset + trayHeight + space.md,
							}}
						/>
					)}
					<StickerSheet
						open={stickersOpen}
						onClose={closeStickers}
						onAddSticker={(sticker) => {
							closeStickers();
							addSticker(() => bundledStickerImage(sticker));
						}}
						savedStickers={savedStickers.stickers}
						savedError={savedStickers.error}
						onAddSaved={(sticker) => {
							closeStickers();
							addSticker(() => savedStickers.place(sticker));
						}}
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
