import {
	useFocusEffect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import {
	detectionTarget,
	detectionTargetKey,
} from "@/detection/detectionTarget";
import { mapDetectionRects } from "@/detection/mapDetectionRects";
import { useImageDetection } from "@/detection/useImageDetection";
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
import type {
	CanvasTool,
	TextEditState,
} from "@/features/editor/canvas/EditorScene";
import { CropTool } from "@/features/editor/crop/CropTool";
import {
	Dock,
	DockFooter,
	INSPECTOR_TRAY_TOP,
	INSPECTOR_WIDTH,
	InspectorBackdrop,
	useDockInset,
} from "@/features/editor/Dock";
import {
	type BrushSettings,
	brushFor,
	parseBrushSettings,
	shapeEdit,
	shapeStyleFor,
	withShape,
} from "@/features/editor/draw/brushSettings";
import { BrushOptions, DrawPanel } from "@/features/editor/draw/DrawPanel";
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
import { ToolsPanel } from "@/features/editor/panels/ToolsPanel";
import { DetectionOptions } from "@/features/editor/redact/DetectionOptions";
import {
	RedactOptions,
	RedactPanel,
} from "@/features/editor/redact/RedactPanel";
import {
	maskBrush,
	parseRedactSettings,
	type RedactSettings,
	redactionEffect,
	sameEffect,
	withEffect,
} from "@/features/editor/redact/redactSettings";
import { SaveErrorBanner } from "@/features/editor/SaveErrorBanner";
import { ShortcutsOverlay } from "@/features/editor/ShortcutsOverlay";
import {
	LAYERS_KEY,
	type Shortcut,
	type ToolKey,
} from "@/features/editor/shortcuts";
import { TrayHeight, TrayPlacement } from "@/features/editor/ToolOptions";
import {
	TextEditor,
	type TextEditorHandle,
} from "@/features/editor/text/TextEditor";
import {
	type TextColorKey,
	TextColorPicker,
	TextStylePanel,
} from "@/features/editor/text/TextStylePanel";
import {
	parseTextStyle,
	withTextEdit,
} from "@/features/editor/text/textSettings";
import { useAddImage } from "@/features/editor/useAddImage";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { importPhoto } from "@/import/photoImport";
import type { TextSelection } from "@/layers/textEditing";
import { textIndexAt } from "@/layers/textLayerLayout";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { errorMessage } from "@/lib/errorMessage";
import { usePreference } from "@/lib/usePreference";
import { neutralAdjustments } from "@/model/adjustments";
import {
	createTextLayer,
	type EditorDocument,
	type ImageLayer,
	isLine,
	isLineShape,
	maxNewImageShortSide,
	type ShapePlacement,
	type TextLayer,
	type TextLayerEdit,
} from "@/model/document";
import type { Framing } from "@/model/framing";
import { type Point, type Rect, toLayerSpace } from "@/model/geometry";
import { exportHref } from "@/projects/projectRoute";
import { addImage } from "@/projects/projectService";
import { useAutosave } from "@/projects/useAutosave";
import { useProjectSession } from "@/projects/useProjectSession";
import { renderThumbnail, sampleColor } from "@/render/renderDocument";
import { SAVED_STICKER_MAX_SIDE } from "@/stickers/savedStickers";
import { bundledStickerImage } from "@/stickers/stickerFile";
import { useSavedStickers } from "@/stickers/useSavedStickers";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedShape,
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
const TOOL_TITLES = { draw: "Draw", redact: "Redact", adjust: "Adjust" };

const parseCustomColor = (saved: unknown) => (isHexColor(saved) ? saved : null);

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

function ScreenContent({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const projectId = useStore((state) => state.projectId);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const selectedRedaction = useStore(selectSelectedRedaction);
	const selectedShape = useStore(selectSelectedShape);
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const addImageLayer = useStore((state) => state.addImageLayer);
	const addStickerLayer = useStore((state) => state.addStickerLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
	const drawStroke = useStore((state) => state.drawStroke);
	const addRedactionBox = useStore((state) => state.addRedactionBox);
	const addRedactionBoxes = useStore((state) => state.addRedactionBoxes);
	const paintRedaction = useStore((state) => state.paintRedaction);
	const setRedactionEffect = useStore((state) => state.setRedactionEffect);
	const addShape = useStore((state) => state.addShape);
	const setShapeStyle = useStore((state) => state.setShapeStyle);
	const setAdjustments = useStore((state) => state.setAdjustments);
	const updateSelectedText = useStore((state) => state.updateSelectedText);
	const updateTextLayer = useStore((state) => state.updateTextLayer);
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
	// A web trackpad pinch commits after a short pause, or at the next press
	// or key. Commit it too where no input comes first: a background save,
	// leaving the screen, and a photo that finished loading.
	const commitPendingPinch = useCallback(
		() => canvasRef.current?.flushPendingTransform(),
		[],
	);

	// Text being typed on the canvas: a new layer, added once editing ends,
	// or the selected one, changed then. What's typed and restyled meanwhile
	// stays here, so the whole edit is one undo step.
	const [textEdit, setTextEdit] = useState<
		(TextEditState & { initialSelection: TextSelection }) | null
	>(null);
	const textEditorRef = useRef<TextEditorHandle>(null);
	const [cropping, setCropping] = useState(false);
	// Typing and cropping take the keyboard, and pasted photos, for themselves.
	const keysTaken = textEdit !== null || cropping;
	const [layersOpen, setLayersOpen] = useState(false);
	const [addOpen, setAddOpen] = useState(false);
	const savedStickers = useSavedStickers();
	// A photo being kept as a sticker, or kept already this session.
	const [stickerSave, setStickerSave] = useState<{
		layerId: string;
		status: "saving" | "saved";
	} | null>(null);
	const windowWidth = useWindowDimensions().width;
	const layersBeside = windowWidth >= SIDEBAR_MIN_WIDTH;
	const wide = windowWidth >= INSPECTOR_MIN_WIDTH;
	// While typing, the dock rides the keyboard, bringing the text's style
	// and Done, and the document fits above them.
	const stageRef = useRef<View>(null);
	const keyboardOverlap = useKeyboardOverlap(stageRef, textEdit !== null);
	const barInset = useDockInset(keyboardOverlap);
	// As an inspector, the dock covers none of the canvas's bottom.
	const dockInset = wide ? 0 : barInset;
	// An open tray's height: the canvas fits above it as well as the dock.
	const [trayHeight, setTrayHeight] = useState(0);
	// The tool in the dock. While drawing, strokes on the canvas go into the
	// selected drawing, or a new one; while redacting, into the selected
	// brushed redaction, or a new one. While adjusting, the canvas holds still.
	const [tool, setTool] = useState<"draw" | "redact" | "adjust" | null>(null);
	// The image being adjusted. The tool puts itself down if it goes away.
	const [adjustedId, setAdjustedId] = useState<string | null>(null);
	const adjustedLayer =
		tool === "adjust"
			? document.layers.find(
					(layer): layer is ImageLayer =>
						layer.type === "image" && !layer.hidden && layer.id === adjustedId,
				)
			: undefined;
	if (tool === "adjust" && !adjustedLayer) setTool(null);
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
	const [toolOptionsOpen, setToolOptionsOpen] = useState(false);
	const [findOpen, setFindOpen] = useState(false);
	// The tools' settings, and the custom color, are kept between sessions.
	const [brushSettings, setBrushSettings] = usePreference(
		"brushSettings",
		parseBrushSettings,
	);
	const [chosenRedactSettings, setRedactSettings] = usePreference(
		"redactSettings",
		parseRedactSettings,
	);
	// The last color picked from a color picker, which every custom swatch
	// keeps while a preset is in use. Null until there's one.
	const [customColor, setCustomColor] = usePreference(
		"customColor",
		parseCustomColor,
	);
	// New text starts in the style text was last given.
	const [textStyle, setTextStyle] = usePreference("textStyle", parseTextStyle);
	// The text the dock styles: what's being typed, or else the selection.
	const styledText: TextLayer | undefined =
		textEdit?.layer ?? selectedTextLayer;
	// Which of a text layer's colors has a picker open over the canvas. It
	// belongs to that layer, and closes if another is styled.
	const [textPicker, setTextPicker] = useState<{
		layerId: string;
		key: TextColorKey;
	} | null>(null);
	if (textPicker && (tool || textPicker.layerId !== styledText?.id)) {
		setTextPicker(null);
	}
	// While set, the canvas's next tap picks a color from what it shows, for
	// `apply` to give to whatever asked for it. The picker it came from
	// closes meanwhile, so the canvas is in view.
	const [eyedropper, setEyedropper] = useState<{
		apply: (color: string) => void;
	} | null>(null);
	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);
	const detectedImage = detectionTarget(document, selectedLayer);
	const detectedImageKey = detectionTargetKey(document, detectedImage);
	const detection = useImageDetection(detectedImageKey);
	const mappedDetections = useMemo(
		() =>
			detectedImage && detection.state.status === "found"
				? detection.state.regions.flatMap(
						({ feature, ...region }, sourceIndex) =>
							mapDetectionRects(
								detectedImage,
								[region],
								documentSize,
								feature,
							).map((mapped) => ({ ...mapped, sourceIndex })),
					)
				: [],
		[detectedImage, detection.state, documentSize],
	);
	const foundDetection =
		detection.state.status === "found" ? detection.state : null;
	const detectionOverlay = useMemo(
		() =>
			mappedDetections.map((region) => ({
				...region,
				selected: foundDetection?.selected.has(region.sourceIndex) ?? false,
			})),
		[mappedDetections, foundDetection],
	);
	const visibleDetectionIndices = useMemo(
		() => mappedDetections.map(({ sourceIndex }) => sourceIndex),
		[mappedDetections],
	);
	const selectedDetectionCount = foundDetection
		? visibleDetectionIndices.filter((index) =>
				foundDetection.selected.has(index),
			).length
		: 0;
	// The style shows the selected redaction's, which new ones then share, so
	// a redaction can be picked to match. Changing it restyles that one too.
	const redactSettings = useMemo(
		() =>
			selectedRedaction
				? withEffect(
						chosenRedactSettings,
						selectedRedaction.effect,
						documentSize,
					)
				: chosenRedactSettings,
		[chosenRedactSettings, selectedRedaction, documentSize],
	);
	const changeRedactSettings = (next: RedactSettings) => {
		setRedactSettings(next);
		if (selectedRedaction && !sameEffect(redactSettings, next)) {
			setRedactionEffect(
				selectedRedaction.id,
				redactionEffect(next, documentSize),
			);
		}
	};
	// Likewise, the shape tool shows the selected shape's style, and changing
	// it restyles that one. A kind it can't become, a box for a line or a line
	// for a box, starts a new shape instead.
	const restyledShape =
		tool === "draw" && brushSettings.tool === "shape"
			? selectedShape
			: undefined;
	const drawSettings = useMemo(
		() =>
			restyledShape
				? withShape(brushSettings, restyledShape, documentSize)
				: brushSettings,
		[brushSettings, restyledShape, documentSize],
	);
	const changeDrawSettings = (next: BrushSettings) => {
		setBrushSettings(next);
		if (!restyledShape) return;
		const edit = shapeEdit(
			drawSettings,
			next,
			documentSize,
			restyledShape.transform.scaleX,
		);
		if (edit.shape && isLineShape(edit.shape) !== isLine(restyledShape)) {
			selectLayer(null);
		} else {
			setShapeStyle(restyledShape.id, edit);
		}
	};
	const canvasTool = useMemo((): CanvasTool | null => {
		if (eyedropper) return { type: "pickColor" };
		if (tool === "draw" && drawSettings.tool === "shape") {
			return {
				type: "drawShape",
				shape: drawSettings.shape,
				style: shapeStyleFor(drawSettings, documentSize),
			};
		}
		if (tool === "draw") {
			return { type: "draw", brush: brushFor(drawSettings, documentSize) };
		}
		if (tool !== "redact") return null;
		const effect = redactionEffect(redactSettings, documentSize);
		const brush = maskBrush(redactSettings, documentSize);
		return brush
			? { type: "redactBrush", brush, effect }
			: { type: "redactBox", effect };
	}, [eyedropper, tool, drawSettings, redactSettings, documentSize]);
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
		setEyedropper((current) => (current === target ? null : current));
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

	const prepareForBackgroundSave = useCallback(() => {
		commitPendingPinch();
		return useStore.getState().document;
	}, [commitPendingPinch]);
	const { error: autosaveError, retry: retryAutosave } = useAutosave(
		projectId,
		document,
		prepareForBackgroundSave,
	);
	const saveProblem =
		projectId === null
			? "This project couldn't be saved, so your edits won't be kept."
			: autosaveError;
	// So the session closes with the latest transform.
	useFocusEffect(useCallback(() => commitPendingPinch, [commitPendingPinch]));

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

	// With the tool that fits the selection: the shape tool for a shape, and a
	// pen for a drawing. Otherwise the tool used last, but never the eraser,
	// so the first stroke shows. Its color and sizes stay.
	const startDrawing = () => {
		setLayersOpen(false);
		setBrushSettings((settings) => {
			if (selectedLayer?.type === "shape") {
				return { ...settings, tool: "shape" };
			}
			const onDrawing = selectedLayer?.type === "drawing";
			return settings.tool === "eraser" ||
				(onDrawing && settings.tool === "shape")
				? { ...settings, tool: settings.lastBrush }
				: settings;
		});
		setTool("draw");
	};
	// With the tool that adds to the selected redaction, if there is one.
	// Otherwise the last one used, but never the eraser, so the first drag
	// shows.
	const startRedacting = () => {
		commitPendingPinch();
		setLayersOpen(false);
		setFindOpen(false);
		detection.reset();
		setRedactSettings((settings) => ({
			...settings,
			tool: selectedRedaction
				? selectedRedaction.shape === "box"
					? "box"
					: "brush"
				: settings.tool === "eraser"
					? "brush"
					: settings.tool,
		}));
		setTool("redact");
	};
	// The selected image, or else the photo, if there's an image at all.
	const adjustable = adjustTarget(document, selectedLayer);
	const startAdjusting = () => {
		if (!adjustable) return;
		setLayersOpen(false);
		setAdjustedId(adjustable.id);
		setTool("adjust");
	};
	const finishTool = () => {
		setTool(null);
		setToolOptionsOpen(false);
		setFindOpen(false);
		detection.reset();
		setEyedropper(null);
	};
	const cancelTool = () => {
		cancelSession();
		finishTool();
	};
	const closeDetection = () => {
		setFindOpen(false);
		detection.reset();
	};
	const toggleDetection = () => {
		setToolOptionsOpen(false);
		if (findOpen) {
			closeDetection();
			return;
		}
		setFindOpen(true);
		startDetection();
	};
	const startDetection = () => {
		if (detectedImage) detection.start(detectedImage.uri);
	};
	const applyDetections = () => {
		const found = detection.state;
		if (found.status !== "found") return;
		const placements = mappedDetections
			.filter(({ sourceIndex }) => found.selected.has(sourceIndex))
			.map(({ width, height, transform }) => ({ width, height, transform }));
		addRedactionBoxes(
			placements,
			redactionEffect(redactSettings, documentSize),
		);
		closeDetection();
	};

	const changeTextEdit = (change: Partial<TextEditState>) =>
		setTextEdit((edit) => edit && { ...edit, ...change });
	const changeEditedText = (patch: TextLayerEdit) =>
		setTextEdit(
			(edit) => edit && { ...edit, layer: { ...edit.layer, ...patch } },
		);
	const startNewText = () => {
		setLayersOpen(false);
		const start = { start: 0, end: 0 };
		setTextEdit({
			layer: createTextLayer(document, "", textStyle),
			isNew: true,
			selection: start,
			initialSelection: start,
			focused: false,
		});
	};
	// With the caret at `index`, or the end.
	const editSelectedText = (index?: number) => {
		if (!selectedTextLayer) return;
		setLayersOpen(false);
		const at = index ?? selectedTextLayer.text.length;
		setTextEdit({
			layer: selectedTextLayer,
			isNew: false,
			selection: { start: at, end: at },
			initialSelection: { start: at, end: at },
			focused: false,
		});
	};
	// Finishing with no text discards a new layer and deletes an existing one.
	const finishTextEdit = () => {
		if (!textEdit) return;
		const { layer, isNew } = textEdit;
		const text = layer.text.trim();
		const { font, color, outlineColor, backgroundColor, align } = layer;
		const style = { font, color, outlineColor, backgroundColor, align };
		if (isNew) {
			if (text) addTextLayer(text, style);
		} else if (text) {
			updateTextLayer(layer.id, { text, ...style });
		} else {
			deleteLayer(layer.id);
		}
		setTextEdit(null);
	};
	// Restyles the text being typed, or else the selected text, and new text
	// starts in the same style. On web, the dock's buttons take focus from
	// the text being typed, so it takes the keyboard back.
	const styleText = (patch: TextLayerEdit) => {
		setTextStyle((style) => withTextEdit(style, patch));
		if (!textEdit) {
			updateSelectedText(patch);
			return;
		}
		changeEditedText(patch);
		if (Platform.OS === "web") textEditorRef.current?.focus();
	};
	const selectText = (selection: TextSelection) => {
		textEditorRef.current?.select(selection);
		changeTextEdit({ selection });
	};

	const startCrop = () => setCropping(true);
	const closeCrop = useCallback(() => setCropping(false), []);
	const finishCrop = (framing: Framing, turnLayers: boolean) => {
		reframe(framing, turnLayers);
		closeCrop();
	};

	// Stable, so the sheets' swipes aren't rebuilt on every render.
	const closeLayers = useCallback(() => setLayersOpen(false), []);
	const closeAdd = useCallback(() => setAddOpen(false), []);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const openAdd = () => {
		setLayersOpen(false);
		setAddOpen(true);
	};

	const handleShortcut = (shortcut: Shortcut): boolean => {
		// The list of shortcuts closes with its own key or Escape, and holds
		// the rest back.
		if (shortcutsOpen) {
			if (shortcut.type === "help" || shortcut.type === "deselect") {
				setShortcutsOpen(false);
			}
			return true;
		}
		if (shortcut.type === "help") {
			setShortcutsOpen(true);
			return true;
		}
		if (shortcut.type === "undo") {
			undo();
			return true;
		}
		if (shortcut.type === "redo") {
			redo();
			return true;
		}
		// The Add sheet's own key, or Escape, closes it; the rest wait.
		if (addOpen) {
			if (
				shortcut.type !== "deselect" &&
				!(shortcut.type === "tool" && shortcut.tool === "add")
			) {
				return false;
			}
			closeAdd();
			return true;
		}
		// Escape stops picking a color, or puts the tool down; the rest pick
		// up another tool or act on a selection, which holds still while a
		// tool is in use.
		if (eyedropper) {
			if (shortcut.type !== "deselect") return false;
			setEyedropper(null);
			return true;
		}
		if (tool) {
			if (shortcut.type !== "deselect") return false;
			finishTool();
			return true;
		}
		if (shortcut.type === "tool") {
			startTool[shortcut.tool]();
			return true;
		}
		if (shortcut.type === "layers") {
			setLayersOpen((open) => !open);
			return true;
		}
		if (!selectedLayer) return false;
		switch (shortcut.type) {
			case "edit":
				if (!selectedTextLayer) return false;
				editSelectedText();
				return true;
			case "delete":
				deleteLayer(selectedLayer.id);
				return true;
			case "deselect":
				selectLayer(null);
				return true;
			case "duplicate":
				duplicateSelectedLayer();
				return true;
			case "reorder":
				moveSelected(shortcut.step);
				return true;
			case "nudge":
				canvasRef.current?.nudgeSelection(shortcut.dx, shortcut.dy);
				return true;
			default:
				return assertNever(shortcut);
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
			commitPendingPinch();
			if (sticker) addStickerLayer(url, width, height, opaque);
			else addImageLayer(url, width, height, opaque);
		},
	});

	// What each tool's key picks up, as its button in the dock would. A
	// selected drawing or redaction takes the strokes, as its own Draw or
	// Redact does.
	const startTool: Record<ToolKey, () => void> = {
		text: startNewText,
		draw: startDrawing,
		redact: startRedacting,
		add: openAdd,
		photo: pickPhoto,
		crop: startCrop,
		adjust: startAdjusting,
	};

	// Shrunk the way a saved sticker is, so a large photo doesn't make one.
	const saveSelectedAsSticker = async () => {
		if (selectedLayer?.type !== "image" || stickerSave?.status === "saving") {
			return;
		}
		const layerId = selectedLayer.id;
		setStickerSave({ layerId, status: "saving" });
		try {
			await savedStickers.save(
				await importPhoto(selectedLayer.uri, {
					maxLongSide: SAVED_STICKER_MAX_SIDE,
				}),
			);
			setStickerSave({ layerId, status: "saved" });
		} catch (error) {
			setStickerSave(null);
			showAlert("Couldn't save sticker", errorMessage(error));
		}
	};

	const layerList = {
		layers: document.layers,
		background: document.background,
		selectedLayerId: selectedLayer?.id ?? null,
		onSelect: (id: string) => {
			finishTextEdit();
			selectLayer(id);
		},
		onMove: moveLayer,
		onSetHidden: setLayerHidden,
		onSetLocked: setLayerLocked,
		onDelete: deleteLayer,
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
		if (textEdit) finishTextEdit();
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
										onPress={() => setLayersOpen((open) => !open)}
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
							textEdit={textEdit}
							onTextSelect={selectText}
							onTextEditDone={finishTextEdit}
							onSelectLayer={selectLayer}
							onTapSelectedLayer={
								selectedTextLayer
									? (point) =>
											editSelectedText(
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
							tool={findOpen ? null : canvasTool}
							detection={
								tool === "redact" && findOpen
									? { regions: detectionOverlay, onToggle: detection.toggle }
									: null
							}
							onPaintStroke={handlePaintStroke}
							onDrawBox={handleDrawBox}
							onDrawShape={handleDrawShape}
							onPickPoint={handlePickPoint}
							onToolInteractionEnd={() => setToolOptionsOpen(false)}
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
											selectedTextLayer ? () => editSelectedText() : undefined
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
								settings={drawSettings}
								customColor={customColor}
								bottomInset={dockInset}
								onChange={changeDrawSettings}
								onPickCustom={(color) => {
									changeDrawSettings({ ...drawSettings, color });
									setCustomColor(color);
								}}
								onEyedropper={() => {
									setToolOptionsOpen(false);
									setEyedropper({
										apply: (color) =>
											changeDrawSettings({ ...drawSettings, color }),
									});
								}}
								onClose={() => setToolOptionsOpen(false)}
							/>
						)}
						{tool === "redact" && toolOptionsOpen && (
							<RedactOptions
								settings={redactSettings}
								customColor={customColor}
								bottomInset={dockInset}
								onChange={changeRedactSettings}
								onPickCustom={(color) => {
									changeRedactSettings({ ...redactSettings, color });
									setCustomColor(color);
								}}
								onEyedropper={() => {
									setToolOptionsOpen(false);
									setEyedropper({
										apply: (color) =>
											changeRedactSettings({ ...redactSettings, color }),
									});
								}}
								onClose={() => setToolOptionsOpen(false)}
							/>
						)}
						{tool === "redact" && findOpen && (
							<DetectionOptions
								state={detection.state}
								visibleIndices={visibleDetectionIndices}
								selectedCount={selectedDetectionCount}
								bottomInset={dockInset}
								onStart={startDetection}
								onSelectAll={() => detection.select(visibleDetectionIndices)}
								onClear={() => detection.select([])}
								onApply={applyDetections}
								onClose={closeDetection}
							/>
						)}
						{textPicker && styledText && (
							<TextColorPicker
								layer={styledText}
								colorKey={textPicker.key}
								bottomInset={dockInset}
								onChange={styleText}
								onPickCustom={setCustomColor}
								onEyedropper={() => {
									const { key } = textPicker;
									setTextPicker(null);
									setEyedropper({
										apply: (color) => styleText({ [key]: color }),
									});
								}}
								onClose={() => setTextPicker(null)}
							/>
						)}
						{eyedropper && (
							<EyedropperHint onCancel={() => setEyedropper(null)} />
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
									tool={textEdit ? "text" : tool}
									addBusy={addBusy}
									onAddText={fromRail(startNewText)}
									onDraw={fromRail(startDrawing)}
									onRedact={fromRail(startRedacting)}
									onAdd={fromRail(openAdd)}
									onCrop={fromRail(startCrop)}
									onAdjust={adjustable ? fromRail(startAdjusting) : undefined}
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
										onDone={finishTool}
										doneShortcut="Escape"
									/>
								) : textEdit ? (
									<DockFooter
										title="Text"
										onCancel={() => setTextEdit(null)}
										onDone={finishTextEdit}
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
									settings={drawSettings}
									optionsOpen={toolOptionsOpen}
									onChange={changeDrawSettings}
									onToggleOptions={() => setToolOptionsOpen((open) => !open)}
								/>
							) : tool === "adjust" ? (
								<AdjustPanel
									controller={adjustController}
									adjustments={adjustedLayer?.adjustments}
								/>
							) : tool === "redact" ? (
								<RedactPanel
									settings={redactSettings}
									optionsOpen={toolOptionsOpen}
									findOpen={findOpen}
									finding={detection.state.status === "working"}
									hasTarget={detectedImage !== null}
									onChange={changeRedactSettings}
									onToggleOptions={() => {
										closeDetection();
										setToolOptionsOpen((open) => !open);
									}}
									onToggleFind={toggleDetection}
								/>
							) : styledText ? (
								<TextStylePanel
									layer={styledText}
									customColor={customColor}
									onChange={styleText}
									onOpenPicker={(key) =>
										setTextPicker({ layerId: styledText.id, key })
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
									sticker={
										stickerSave?.layerId === selectedLayer.id
											? stickerSave.status
											: undefined
									}
									onSaveSticker={
										selectedLayer.type === "image" && !selectedLayer.sticker
											? saveSelectedAsSticker
											: undefined
									}
								/>
							) : wide ? (
								<LayersPanel {...layerList} layout="inspector" open />
							) : (
								<ToolsPanel
									addBusy={addBusy}
									onAddText={startNewText}
									onDraw={startDrawing}
									onRedact={startRedacting}
									onAdd={openAdd}
									onCrop={startCrop}
									onAdjust={adjustable ? startAdjusting : undefined}
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
					{textEdit && (
						<TextEditor
							ref={textEditorRef}
							text={textEdit.layer.text}
							initialSelection={textEdit.initialSelection}
							onChangeText={(text) => changeEditedText({ text })}
							onSelectionChange={(selection) => changeTextEdit({ selection })}
							onFocusChange={(focused) => changeTextEdit({ focused })}
							onDone={finishTextEdit}
						/>
					)}
					{shortcutsOpen && (
						<ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />
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
