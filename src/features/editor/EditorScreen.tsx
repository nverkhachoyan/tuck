import {
	useFocusEffect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
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
import { Dock, DockButton, useDockInset } from "@/features/editor/Dock";
import {
	brushFor,
	parseBrushSettings,
} from "@/features/editor/draw/brushSettings";
import { BrushOptions, DrawPanel } from "@/features/editor/draw/DrawPanel";
import { LayerActionsPanel } from "@/features/editor/panels/LayerActionsPanel";
import {
	LAYERS_SIDEBAR_INSET,
	LayersPanel,
} from "@/features/editor/panels/LayersPanel";
import { ToolsPanel } from "@/features/editor/panels/ToolsPanel";
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
import {
	LAYERS_KEY,
	type Shortcut,
	type ToolKey,
} from "@/features/editor/shortcuts";
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
import { useAddPhoto } from "@/features/editor/useAddPhoto";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import type { TextSelection } from "@/layers/textEditing";
import { textIndexAt } from "@/layers/textLayerLayout";
import { assertNever } from "@/lib/assertNever";
import { isHexColor } from "@/lib/color";
import { usePreference } from "@/lib/usePreference";
import {
	createTextLayer,
	type EditorDocument,
	maxNewImageShortSide,
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
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;

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
			<ScreenHeader backLabel="Projects" onBack={() => leaveEditor(router)} />
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
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const addImageLayer = useStore((state) => state.addImageLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
	const drawStroke = useStore((state) => state.drawStroke);
	const addRedactionBox = useStore((state) => state.addRedactionBox);
	const paintRedaction = useStore((state) => state.paintRedaction);
	const setRedactionEffect = useStore((state) => state.setRedactionEffect);
	const updateSelectedText = useStore((state) => state.updateSelectedText);
	const updateTextLayer = useStore((state) => state.updateTextLayer);
	const transformLayer = useStore((state) => state.transformLayer);
	const resizeRedactionBox = useStore((state) => state.resizeRedactionBox);
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
	const layersBeside = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
	const dockInset = useDockInset();
	// The tool dragging on the canvas uses in place of moving layers. While
	// drawing, strokes go into the selected drawing, or a new one; while
	// redacting, into the selected brushed redaction, or a new one.
	const [tool, setTool] = useState<"draw" | "redact" | null>(null);
	const [toolOptionsOpen, setToolOptionsOpen] = useState(false);
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
	const canvasTool = useMemo((): CanvasTool | null => {
		if (eyedropper) return { type: "pickColor" };
		if (tool === "draw") {
			return { type: "draw", brush: brushFor(brushSettings, documentSize) };
		}
		if (tool !== "redact") return null;
		const effect = redactionEffect(redactSettings, documentSize);
		const brush = maskBrush(redactSettings, documentSize);
		return brush
			? { type: "redactBrush", brush, effect }
			: { type: "redactBox", effect };
	}, [eyedropper, tool, brushSettings, redactSettings, documentSize]);
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

	// With the pen used last, but never the eraser, so the first stroke
	// shows. Its color and sizes stay.
	const startDrawing = () => {
		setLayersOpen(false);
		setBrushSettings((settings) =>
			settings.tool === "eraser" ? { ...settings, tool: "pen" } : settings,
		);
		setTool("draw");
	};
	// With the tool that adds to the selected redaction, if there is one.
	// Otherwise the last one used, but never the eraser, so the first drag
	// shows.
	const startRedacting = () => {
		setLayersOpen(false);
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
	const finishTool = () => {
		setTool(null);
		setToolOptionsOpen(false);
		setEyedropper(null);
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

	// Stable, so the layers sheet's swipe isn't rebuilt on every render.
	const closeLayers = useCallback(() => setLayersOpen(false), []);

	const handleShortcut = (shortcut: Shortcut): boolean => {
		if (shortcut.type === "undo") {
			undo();
			return true;
		}
		if (shortcut.type === "redo") {
			redo();
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
		busy: photoBusy,
		dragging,
		pick: pickPhoto,
	} = useAddPhoto({
		// On web, an image pasted or dropped onto the editor joins the canvas,
		// unless another screen or tool is in front of it.
		enabled: focused && !keysTaken,
		maxShortSide: maxNewImageShortSide(document),
		// The photo moves into the project, so autosave knows its file.
		// Without a project, it's used where the picker left it.
		onPhoto: async ({ uri, width, height, opaque }) => {
			const url =
				projectId === null ? uri : await addImage(projectId, uri, opaque);
			commitPendingPinch();
			addImageLayer(url, width, height, opaque);
		},
	});

	// What each tool's key picks up, as its button in the dock would. A
	// selected drawing or redaction takes the strokes, as its own Draw or
	// Redact does.
	const startTool: Record<ToolKey, () => void> = {
		text: startNewText,
		draw: startDrawing,
		redact: startRedacting,
		photo: pickPhoto,
		crop: startCrop,
	};

	// The sidebar stops above the dock, which stays usable.
	const layersPanel = (
		<LayersPanel
			layout={layersBeside ? "sidebar" : "sheet"}
			bottomInset={dockInset}
			open={layersOpen}
			onClose={closeLayers}
			layers={document.layers}
			background={document.background}
			selectedLayerId={selectedLayer?.id ?? null}
			onSelect={(id) => {
				finishTextEdit();
				selectLayer(id);
			}}
			onMove={moveLayer}
			onSetHidden={setLayerHidden}
			onSetLocked={setLayerLocked}
			onDelete={deleteLayer}
			onSetBackground={setBackground}
		/>
	);

	return (
		<View style={styles.container}>
			<ScreenHeader
				backLabel="Projects"
				onBack={() => leaveEditor(router)}
				action={
					<View style={styles.headerActions}>
						{!tool && (
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
						{/* A tool is put down from the dock. */}
						{!tool && (
							<Button
								label="Export"
								icon="share-outline"
								variant="primary"
								size="small"
								onPress={() => router.push(exportHref(projectId))}
							/>
						)}
					</View>
				}
			/>
			{/* The dock floats over the stage, which runs under it. */}
			<CanvasStage toBottom>
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
					onResizeBox={resizeRedactionBox}
					onNudgeLayer={nudgeLayer}
					tool={canvasTool}
					onPaintStroke={handlePaintStroke}
					onDrawBox={handleDrawBox}
					onPickPoint={handlePickPoint}
					bottomInset={dockInset}
				/>
				{tool === "draw" && toolOptionsOpen && (
					<BrushOptions
						settings={brushSettings}
						customColor={customColor}
						bottomInset={dockInset}
						onChange={setBrushSettings}
						onPickCustom={(color) => {
							setBrushSettings((settings) => ({ ...settings, color }));
							setCustomColor(color);
						}}
						onEyedropper={() => {
							setToolOptionsOpen(false);
							setEyedropper({
								apply: (color) =>
									setBrushSettings((settings) => ({ ...settings, color })),
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
				{eyedropper && <EyedropperHint onCancel={() => setEyedropper(null)} />}
				{saveProblem && (
					<SaveErrorBanner
						message={saveProblem}
						onRetry={projectId !== null ? retryAutosave : undefined}
						rightInset={
							layersBeside && layersOpen ? LAYERS_SIDEBAR_INSET : undefined
						}
					/>
				)}
				{layersBeside && layersPanel}

				{/* After the tool's options, so taps on the dock reach it rather
				    than closing them. */}
				<Dock
					panel={panelKind}
					start={
						tool ? (
							<DockButton
								icon="chevron-back"
								label="Back to tools"
								shortcut="Escape"
								onPress={finishTool}
							/>
						) : undefined
					}
				>
					{tool === "draw" ? (
						<DrawPanel
							settings={brushSettings}
							onChange={setBrushSettings}
							onToggleOptions={() => setToolOptionsOpen((open) => !open)}
						/>
					) : tool === "redact" ? (
						<RedactPanel
							settings={redactSettings}
							optionsOpen={toolOptionsOpen}
							onChange={changeRedactSettings}
							onToggleOptions={() => setToolOptionsOpen((open) => !open)}
						/>
					) : styledText ? (
						<TextStylePanel
							layer={styledText}
							editing={textEdit !== null}
							customColor={customColor}
							onChange={styleText}
							onOpenPicker={(key) =>
								setTextPicker({ layerId: styledText.id, key })
							}
							onEdit={() => editSelectedText()}
							onToggleResize={() =>
								setLayerResizable(styledText.id, !styledText.resizable)
							}
							onDuplicate={duplicateSelectedLayer}
							onDelete={() => deleteLayer(styledText.id)}
						/>
					) : selectedLayer ? (
						<LayerActionsPanel
							canMoveForward={selectedIndex < document.layers.length - 1}
							canMoveBackward={selectedIndex > 0}
							onDraw={
								selectedLayer.type === "drawing" ? startDrawing : undefined
							}
							onRedact={
								selectedLayer.type === "redaction" ? startRedacting : undefined
							}
							resizeEnabled={selectedLayer.resizable === true}
							onToggleResize={
								selectedLayer.type === "image"
									? () =>
											setLayerResizable(
												selectedLayer.id,
												!selectedLayer.resizable,
											)
									: undefined
							}
							onMoveForward={() => moveSelected(1)}
							onMoveBackward={() => moveSelected(-1)}
							onDuplicate={duplicateSelectedLayer}
							onDelete={() => deleteLayer(selectedLayer.id)}
						/>
					) : (
						<ToolsPanel
							photoBusy={photoBusy}
							onAddText={startNewText}
							onDraw={startDrawing}
							onRedact={startRedacting}
							onAddPhoto={pickPhoto}
							onCrop={startCrop}
						/>
					)}
				</Dock>
			</CanvasStage>
			{!layersBeside && layersPanel}

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
					align={textEdit.layer.align}
					initialSelection={textEdit.initialSelection}
					onChangeText={(text) => changeEditedText({ text })}
					onChangeAlign={(align) => styleText({ align })}
					onSelectionChange={(selection) => changeTextEdit({ selection })}
					onFocusChange={(focused) => changeTextEdit({ focused })}
					onDone={finishTextEdit}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 22,
	},
	status: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 24,
	},
	statusTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	statusMessage: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
		marginBottom: 12,
	},
});
