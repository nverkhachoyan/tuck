import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
	EditorCanvas,
	type EditorCanvasHandle,
} from "@/editor/canvas/EditorCanvas";
import { CropTool } from "@/editor/crop/CropTool";
import { BottomPanel } from "@/editor/panels/BottomPanel";
import {
	BrushOptions,
	type BrushSettings,
	brushFor,
	DrawPanel,
	defaultBrushSettings,
} from "@/editor/panels/DrawPanel";
import { LayerActionsPanel } from "@/editor/panels/LayerActionsPanel";
import { LAYERS_SIDEBAR_INSET, LayersPanel } from "@/editor/panels/LayersPanel";
import { TextEditor } from "@/editor/panels/TextEditor";
import { TextEditPanel } from "@/editor/panels/TextEditPanel";
import { ToolsPanel } from "@/editor/panels/ToolsPanel";
import { SaveErrorBanner } from "@/editor/SaveErrorBanner";
import type { Shortcut } from "@/editor/shortcuts";
import { useEditorShortcuts } from "@/editor/useEditorShortcuts";
import { useAddPhoto } from "@/import/useAddPhoto";
import { assertNever } from "@/lib/assertNever";
import {
	defaultTextStyle,
	type EditorDocument,
	maxNewImageShortSide,
	type TextAlign,
} from "@/model/document";
import type { Framing } from "@/model/framing";
import { addImage, useAutosave } from "@/projects/projects";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;

export default function EditorRoute() {
	const document = useStore((state) => state.document);

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	return <EditorScreen document={document} />;
}

function EditorScreen({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const projectId = useStore((state) => state.projectId);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const addImageLayer = useStore((state) => state.addImageLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
	const drawStroke = useStore((state) => state.drawStroke);
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
	// A web trackpad pinch commits after a short pause. Commit it before
	// anything else changes the document, so undo steps keep their order.
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
	// While drawing, strokes go into the selected drawing, or a new one.
	const [drawing, setDrawing] = useState(false);
	const [brushSettings, setBrushSettings] =
		useState<BrushSettings>(defaultBrushSettings);
	const [brushOptionsOpen, setBrushOptionsOpen] = useState(false);
	const brush = useMemo(
		() =>
			drawing
				? brushFor(brushSettings, {
						width: document.width,
						height: document.height,
					})
				: null,
		[drawing, brushSettings, document.width, document.height],
	);

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

	const handleUndo = () => {
		commitPendingPinch();
		undo();
	};
	const handleRedo = () => {
		commitPendingPinch();
		redo();
	};

	const selectedIndex = selectedLayer
		? document.layers.indexOf(selectedLayer)
		: -1;
	const moveSelected = (step: 1 | -1) => {
		if (!selectedLayer) return;
		commitPendingPinch();
		moveLayer(selectedLayer.id, selectedIndex + step);
	};
	const duplicateSelected = () => {
		commitPendingPinch();
		duplicateSelectedLayer();
	};

	// Always with the pen, so the first stroke shows. Its color and sizes stay.
	const startDrawing = () => {
		commitPendingPinch();
		setLayersOpen(false);
		setBrushSettings((settings) => ({ ...settings, tool: "pen" }));
		setDrawing(true);
	};
	const finishDrawing = () => {
		setDrawing(false);
		setBrushOptionsOpen(false);
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

	const startCrop = () => {
		commitPendingPinch();
		setCropping(true);
	};
	const closeCrop = useCallback(() => setCropping(false), []);
	const finishCrop = (framing: Framing, turnLayers: boolean) => {
		reframe(framing, turnLayers);
		closeCrop();
	};

	// Stable, so the layers sheet's swipe isn't rebuilt on every render.
	const closeLayers = useCallback(() => setLayersOpen(false), []);

	const goBack = () => {
		commitPendingPinch();
		// Opened from a link to the create screen, there's nothing behind the
		// editor; the welcome screen still ends the session.
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};

	const handleShortcut = (shortcut: Shortcut): boolean => {
		if (shortcut.type === "undo") {
			handleUndo();
			return true;
		}
		if (shortcut.type === "redo") {
			handleRedo();
			return true;
		}
		// Escape puts the pen down; the rest act on a selection, which holds
		// still while drawing.
		if (drawing) {
			if (shortcut.type !== "deselect") return false;
			finishDrawing();
			return true;
		}
		if (!selectedLayer) return false;
		commitPendingPinch();
		switch (shortcut.type) {
			case "delete":
				deleteLayer(selectedLayer.id);
				return true;
			case "deselect":
				selectLayer(null);
				return true;
			case "duplicate":
				duplicateSelected();
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

	// The sidebar covers only the canvas, so the bottom panel stays usable.
	const layersPanel = (
		<LayersPanel
			layout={layersBeside ? "sidebar" : "sheet"}
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
						{!drawing && (
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
							onPress={handleUndo}
						/>
						<IconButton
							icon="arrow-redo-outline"
							label="Redo"
							shortcut="mod+shift+Z"
							disabled={!canRedo}
							onPress={handleRedo}
						/>
						{drawing ? (
							<Button
								label="Done"
								variant="primary"
								size="small"
								onPress={finishDrawing}
							/>
						) : (
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
			<View style={styles.canvasArea}>
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
					brush={brush}
					onPaintStroke={drawStroke}
				/>
				{drawing && brushOptionsOpen && (
					<BrushOptions
						settings={brushSettings}
						onChange={setBrushSettings}
						onClose={() => setBrushOptionsOpen(false)}
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
			</View>

			<BottomPanel>
				{drawing ? (
					<DrawPanel
						settings={brushSettings}
						optionsOpen={brushOptionsOpen}
						onChange={setBrushSettings}
						onToggleOptions={() => setBrushOptionsOpen((open) => !open)}
					/>
				) : selectedTextLayer ? (
					<TextEditPanel
						layer={selectedTextLayer}
						onChange={updateSelectedText}
						onEdit={() => setEditing("selected")}
						onDuplicate={duplicateSelected}
						onDelete={() => deleteLayer(selectedTextLayer.id)}
					/>
				) : selectedLayer ? (
					<LayerActionsPanel
						canMoveForward={selectedIndex < document.layers.length - 1}
						canMoveBackward={selectedIndex > 0}
						onDraw={selectedLayer.type === "drawing" ? startDrawing : undefined}
						onMoveForward={() => moveSelected(1)}
						onMoveBackward={() => moveSelected(-1)}
						onDuplicate={duplicateSelected}
						onDelete={() => deleteLayer(selectedLayer.id)}
					/>
				) : (
					<ToolsPanel
						photoBusy={photoBusy}
						onAddText={() => setEditing("new")}
						onDraw={startDrawing}
						onAddPhoto={pickPhoto}
						onCrop={startCrop}
					/>
				)}
			</BottomPanel>
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
	canvasArea: {
		flex: 1,
		backgroundColor: colors.canvasWell,
	},
});
