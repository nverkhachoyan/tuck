import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
	EditorCanvas,
	type EditorCanvasHandle,
} from "@/features/editor/canvas/EditorCanvas";
import type { CanvasTool } from "@/features/editor/canvas/EditorScene";
import { CropTool } from "@/features/editor/crop/CropTool";
import { Dock, DockButton, useDockInset } from "@/features/editor/Dock";
import {
	type BrushSettings,
	brushFor,
	defaultBrushSettings,
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
	defaultRedactSettings,
	maskBrush,
	type RedactSettings,
	redactionEffect,
	sameEffect,
	withEffect,
} from "@/features/editor/redact/redactSettings";
import { SaveErrorBanner } from "@/features/editor/SaveErrorBanner";
import type { Shortcut } from "@/features/editor/shortcuts";
import { TextEditor } from "@/features/editor/text/TextEditor";
import { TextStylePanel } from "@/features/editor/text/TextStylePanel";
import { useAddPhoto } from "@/features/editor/useAddPhoto";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { assertNever } from "@/lib/assertNever";
import {
	defaultTextStyle,
	type EditorDocument,
	maxNewImageShortSide,
	type TextAlign,
} from "@/model/document";
import type { Framing } from "@/model/framing";
import type { Rect } from "@/model/geometry";
import { addImage } from "@/projects/projectService";
import { useAutosave } from "@/projects/useAutosave";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { DropOverlay } from "@/ui/DropOverlay";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;

export default function EditorScreen() {
	const document = useStore((state) => state.document);

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	return <ScreenContent document={document} />;
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
	const transformLayer = useStore((state) => state.transformLayer);
	const nudgeLayer = useStore((state) => state.nudgeLayer);
	const moveLayer = useStore((state) => state.moveLayer);
	const setLayerHidden = useStore((state) => state.setLayerHidden);
	const setLayerLocked = useStore((state) => state.setLayerLocked);
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

	// What the full-screen text editor is open for: a layer that doesn't exist
	// yet, or the selected one. The layer is only created or changed on Done.
	const [editing, setEditing] = useState<"new" | "selected" | null>(null);
	const [cropping, setCropping] = useState(false);
	const fullScreenToolOpen = editing !== null || cropping;
	const [layersOpen, setLayersOpen] = useState(false);
	const layersBeside = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
	const dockInset = useDockInset();
	// The tool dragging on the canvas uses in place of moving layers. While
	// drawing, strokes go into the selected drawing, or a new one; while
	// redacting, into the selected brushed redaction, or a new one.
	const [tool, setTool] = useState<"draw" | "redact" | null>(null);
	const [toolOptionsOpen, setToolOptionsOpen] = useState(false);
	const [brushSettings, setBrushSettings] =
		useState<BrushSettings>(defaultBrushSettings);
	const [chosenRedactSettings, setRedactSettings] = useState<RedactSettings>(
		defaultRedactSettings,
	);
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
		if (tool === "draw") {
			return { type: "draw", brush: brushFor(brushSettings, documentSize) };
		}
		if (tool !== "redact") return null;
		const effect = redactionEffect(redactSettings, documentSize);
		const brush = maskBrush(redactSettings, documentSize);
		return brush
			? { type: "redactBrush", brush, effect }
			: { type: "redactBox", effect };
	}, [tool, brushSettings, redactSettings, documentSize]);
	const handlePaintStroke = (points: number[]) => {
		if (canvasTool?.type === "draw") {
			drawStroke({ ...canvasTool.brush, points });
		} else if (canvasTool?.type === "redactBrush") {
			paintRedaction({ ...canvasTool.brush, points }, canvasTool.effect);
		}
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

	// Always with the pen, so the first stroke shows. Its color and sizes stay.
	const startDrawing = () => {
		setLayersOpen(false);
		setBrushSettings((settings) => ({ ...settings, tool: "pen" }));
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
	};

	// Finishing with no text discards a new layer and deletes an existing one.
	const handleEditDone = (rawText: string, align: TextAlign) => {
		const text = rawText.trim();
		if (editing === "new") {
			if (text) addTextLayer(text, align);
		} else if (text) {
			updateSelectedText({ text, align });
		} else if (selectedTextLayer) {
			deleteLayer(selectedTextLayer.id);
		}
		setEditing(null);
	};

	const startCrop = () => setCropping(true);
	const closeCrop = useCallback(() => setCropping(false), []);
	const finishCrop = (framing: Framing, turnLayers: boolean) => {
		reframe(framing, turnLayers);
		closeCrop();
	};

	// Stable, so the layers sheet's swipe isn't rebuilt on every render.
	const closeLayers = useCallback(() => setLayersOpen(false), []);

	const goBack = () => {
		// Opened from a link to the create screen, there's nothing behind the
		// editor; the welcome screen still ends the session.
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};

	const handleShortcut = (shortcut: Shortcut): boolean => {
		if (shortcut.type === "undo") {
			undo();
			return true;
		}
		if (shortcut.type === "redo") {
			redo();
			return true;
		}
		// Escape puts the tool down; the rest act on a selection, which holds
		// still while a tool is in use.
		if (tool) {
			if (shortcut.type !== "deselect") return false;
			finishTool();
			return true;
		}
		if (!selectedLayer) return false;
		switch (shortcut.type) {
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
		enabled: !fullScreenToolOpen,
		onShortcut: handleShortcut,
	});

	const panelKind = tool
		? tool
		: selectedTextLayer
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
		enabled: focused && !fullScreenToolOpen,
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
			onSelect={selectLayer}
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
				onBack={goBack}
				action={
					<View style={styles.headerActions}>
						{!tool && (
							<IconButton
								icon="layers-outline"
								label="Layers"
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
								onPress={() => router.push("/export")}
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
					hiddenLayerId={
						editing === "selected" ? (selectedTextLayer?.id ?? null) : null
					}
					onSelectLayer={selectLayer}
					onTapSelectedLayer={
						selectedTextLayer ? () => setEditing("selected") : undefined
					}
					onCommitTransform={transformLayer}
					onNudgeLayer={nudgeLayer}
					tool={canvasTool}
					onPaintStroke={handlePaintStroke}
					onDrawBox={handleDrawBox}
					bottomInset={dockInset}
				/>
				{tool === "draw" && toolOptionsOpen && (
					<BrushOptions
						settings={brushSettings}
						bottomInset={dockInset}
						onChange={setBrushSettings}
						onClose={() => setToolOptionsOpen(false)}
					/>
				)}
				{tool === "redact" && toolOptionsOpen && (
					<RedactOptions
						settings={redactSettings}
						bottomInset={dockInset}
						onChange={changeRedactSettings}
						onClose={() => setToolOptionsOpen(false)}
					/>
				)}
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
							optionsOpen={toolOptionsOpen}
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
					) : selectedTextLayer ? (
						<TextStylePanel
							layer={selectedTextLayer}
							onChange={updateSelectedText}
							onEdit={() => setEditing("selected")}
							onDuplicate={duplicateSelectedLayer}
							onDelete={() => deleteLayer(selectedTextLayer.id)}
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
							onMoveForward={() => moveSelected(1)}
							onMoveBackward={() => moveSelected(-1)}
							onDuplicate={duplicateSelectedLayer}
							onDelete={() => deleteLayer(selectedLayer.id)}
						/>
					) : (
						<ToolsPanel
							photoBusy={photoBusy}
							onAddText={() => setEditing("new")}
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
			{editing === "new" && (
				<TextEditor
					initialText=""
					layerStyle={defaultTextStyle}
					onDone={handleEditDone}
				/>
			)}
			{editing === "selected" && selectedTextLayer && (
				<TextEditor
					initialText={selectedTextLayer.text}
					layerStyle={selectedTextLayer}
					onDone={handleEditDone}
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
});
