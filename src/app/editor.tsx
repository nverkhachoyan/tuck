import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	EditorCanvas,
	type EditorCanvasHandle,
} from "@/editor/canvas/EditorCanvas";
import { CropTool } from "@/editor/crop/CropTool";
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
import type { Shortcut } from "@/editor/shortcuts";
import { useEditorShortcuts } from "@/editor/useEditorShortcuts";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/import/pickPhoto";
import { usePhotoDrop } from "@/import/usePhotoDrop";
import { assertNever } from "@/lib/assertNever";
import { errorMessage } from "@/lib/errorMessage";
import { showAlert } from "@/lib/showAlert";
import {
	defaultTextStyle,
	maxNewImageShortSide,
	type TextAlign,
} from "@/model/document";
import { addImage, useAutosave } from "@/projects/projects";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors, radii } from "@/theme";
import { Button } from "@/ui/Button";
import { DropOverlay } from "@/ui/DropOverlay";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { ToolButton } from "@/ui/ToolButton";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;
// Toolbar and text panel share one fixed height, above the home indicator,
// so the canvas above never resizes when the selection changes.
const BOTTOM_PANEL_HEIGHT = 124;

export default function EditorRoute() {
	const router = useRouter();
	const document = useStore((state) => state.document);
	const projectId = useStore((state) => state.projectId);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
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
	const canUndo = useStore(selectCanUndo);
	const canRedo = useStore(selectCanRedo);
	const canvasRef = useRef<EditorCanvasHandle>(null);
	// What the full-screen text editor is open for: a layer that doesn't exist
	// yet, or the selected one. The layer is only created or changed on Done.
	const [editing, setEditing] = useState<"new" | "selected" | null>(null);
	const [cropping, setCropping] = useState(false);
	const [layersOpen, setLayersOpen] = useState(false);
	const layersBeside = useWindowDimensions().width >= SIDEBAR_MIN_WIDTH;
	const { bottom } = useSafeAreaInsets();
	// While drawing, strokes go into the selected drawing, or a new one.
	const [drawing, setDrawing] = useState(false);
	const [brushSettings, setBrushSettings] =
		useState<BrushSettings>(defaultBrushSettings);
	const [brushOptionsOpen, setBrushOptionsOpen] = useState(false);
	const documentWidth = document?.width ?? 0;
	const documentHeight = document?.height ?? 0;
	const brush = useMemo(
		() =>
			drawing
				? brushFor(brushSettings, {
						width: documentWidth,
						height: documentHeight,
					})
				: null,
		[drawing, brushSettings, documentWidth, documentHeight],
	);
	// Picking and re-encoding a large photo takes a few seconds. Set at once,
	// so a second tap meanwhile can't open another picker.
	const addingPhoto = useRef(false);
	const [photoBusy, setPhotoBusy] = useState(false);
	const prepareForBackgroundSave = useCallback(() => {
		canvasRef.current?.flushPendingTransform();
		return useStore.getState().document;
	}, []);

	const { error: autosaveError, retry: retryAutosave } = useAutosave(
		projectId,
		document,
		prepareForBackgroundSave,
	);
	const saveProblem =
		projectId === null
			? "This project couldn't be saved, so your edits won't be kept."
			: autosaveError;
	// A web trackpad pinch commits after a short pause. Commit it before this
	// screen loses focus so the session closes with the latest transform.
	useFocusEffect(
		useCallback(() => () => canvasRef.current?.flushPendingTransform(), []),
	);

	const handleUndo = useCallback(() => {
		canvasRef.current?.flushPendingTransform();
		undo();
	}, [undo]);
	const handleRedo = useCallback(() => {
		canvasRef.current?.flushPendingTransform();
		redo();
	}, [redo]);

	// Always with the pen, so the first stroke shows. Its color and sizes stay.
	const startDrawing = () => {
		canvasRef.current?.flushPendingTransform();
		setLayersOpen(false);
		setBrushSettings((settings) => ({ ...settings, tool: "pen" }));
		setDrawing(true);
	};
	const finishDrawing = useCallback(() => {
		setDrawing(false);
		setBrushOptionsOpen(false);
	}, []);

	const handleShortcut = useCallback(
		(shortcut: Shortcut) => {
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
			if (!document || !selectedLayer) return false;
			canvasRef.current?.flushPendingTransform();
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
				case "reorder": {
					const index = document.layers.findIndex(
						(layer) => layer.id === selectedLayer.id,
					);
					moveLayer(selectedLayer.id, index + shortcut.step);
					return true;
				}
				case "nudge":
					canvasRef.current?.nudgeSelection(shortcut.dx, shortcut.dy);
					return true;
				default:
					return assertNever(shortcut);
			}
		},
		[
			handleUndo,
			handleRedo,
			drawing,
			finishDrawing,
			document,
			selectedLayer,
			deleteLayer,
			selectLayer,
			duplicateSelectedLayer,
			moveLayer,
		],
	);

	useEditorShortcuts({
		enabled: editing === null && !cropping,
		onShortcut: handleShortcut,
	});

	const closeCrop = useCallback(() => setCropping(false), []);
	// Stable, so the layers sheet's swipe isn't rebuilt on every render.
	const closeLayers = useCallback(() => setLayersOpen(false), []);

	// The photo shrinks to what this canvas can use, then moves into the
	// project, so autosave knows its file. Without a project, it's used where
	// the picker left it.
	const addPhoto = async (
		load: (maxShortSide: number) => Promise<PickedPhoto | null>,
	) => {
		if (addingPhoto.current || !document) return;
		addingPhoto.current = true;
		setPhotoBusy(true);
		try {
			const photo = await load(maxNewImageShortSide(document));
			if (!photo) return;
			const { uri, width, height, opaque } = photo;
			const url =
				projectId === null ? uri : await addImage(projectId, uri, opaque);
			canvasRef.current?.flushPendingTransform();
			addImageLayer(url, width, height, opaque);
		} catch (error) {
			showAlert("Couldn't add photo", errorMessage(error));
		} finally {
			addingPhoto.current = false;
			setPhotoBusy(false);
		}
	};
	const handleAddPhoto = () =>
		addPhoto(async (maxShortSide) => {
			const result = await pickPhoto({ maxShortSide });
			return result.status === "canceled" ? null : result.photo;
		});

	// On web, an image pasted or dropped onto the editor joins the canvas,
	// unless another screen or tool is in front of it.
	const focused = useIsFocused();
	const { dragging } = usePhotoDrop({
		enabled: focused && editing === null && !cropping,
		onPhoto: (uri) =>
			addPhoto((maxShortSide) => importPhoto(uri, { maxShortSide })),
	});

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

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

	const selectedIndex = selectedLayer
		? document.layers.indexOf(selectedLayer)
		: -1;
	const moveSelected = (step: 1 | -1) => {
		if (!selectedLayer) return;
		canvasRef.current?.flushPendingTransform();
		moveLayer(selectedLayer.id, selectedIndex + step);
	};

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
				onBack={() => {
					canvasRef.current?.flushPendingTransform();
					// Opened from a link to the create screen, there's nothing
					// behind the editor; the welcome screen still ends the session.
					if (router.canGoBack()) router.back();
					else router.replace("/");
				}}
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
					<View
						style={[
							styles.saveErrorArea,
							layersBeside && layersOpen && { right: LAYERS_SIDEBAR_INSET },
						]}
					>
						<View style={styles.saveError}>
							<Ionicons
								name="cloud-offline-outline"
								size={20}
								color={colors.accent}
							/>
							<Text style={styles.saveErrorText}>{saveProblem}</Text>
							{projectId !== null && (
								<Button label="Retry" size="small" onPress={retryAutosave} />
							)}
						</View>
					</View>
				)}
				{layersBeside && layersPanel}
			</View>

			<View
				style={[
					styles.bottomPanel,
					{ height: BOTTOM_PANEL_HEIGHT + bottom, paddingBottom: bottom },
				]}
			>
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
						onDuplicate={duplicateSelectedLayer}
						onDelete={() => deleteLayer(selectedTextLayer.id)}
					/>
				) : selectedLayer ? (
					<LayerActionsPanel
						canMoveForward={selectedIndex < document.layers.length - 1}
						canMoveBackward={selectedIndex > 0}
						onDraw={selectedLayer.type === "drawing" ? startDrawing : undefined}
						onMoveForward={() => moveSelected(1)}
						onMoveBackward={() => moveSelected(-1)}
						onDuplicate={() => {
							canvasRef.current?.flushPendingTransform();
							duplicateSelectedLayer();
						}}
						onDelete={() => deleteLayer(selectedLayer.id)}
					/>
				) : (
					<View style={styles.toolbar}>
						<ToolButton
							label="Text"
							icon="format-text"
							onPress={() => setEditing("new")}
						/>
						<ToolButton label="Draw" icon="draw" onPress={startDrawing} />
						<ToolButton
							label="Photo"
							icon="image-plus"
							busy={photoBusy}
							onPress={() => void handleAddPhoto()}
						/>
						<ToolButton
							label="Crop"
							icon="crop-rotate"
							onPress={() => {
								canvasRef.current?.flushPendingTransform();
								setCropping(true);
							}}
						/>
					</View>
				)}
			</View>
			{!layersBeside && layersPanel}

			{dragging && <DropOverlay label="Drop to add to the canvas" />}
			{cropping && (
				<CropTool
					document={document}
					onCancel={closeCrop}
					onDone={(framing, turnLayers) => {
						reframe(framing, turnLayers);
						closeCrop();
					}}
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
	// Over the canvas rather than above it, so showing it doesn't resize the
	// canvas mid-gesture.
	saveErrorArea: {
		position: "absolute",
		top: 12,
		left: 12,
		right: 12,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	saveError: {
		width: "100%",
		maxWidth: 560,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingLeft: 14,
		paddingRight: 8,
		paddingVertical: 8,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: colors.accentSoft,
		backgroundColor: colors.surface,
		boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
	},
	saveErrorText: {
		flex: 1,
		fontSize: 14,
		lineHeight: 19,
		color: colors.textPrimary,
	},
	bottomPanel: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	// Tools sit centered as a group; more tools join the row later.
	toolbar: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 28,
		paddingHorizontal: 20,
	},
});
