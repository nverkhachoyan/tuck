import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
	EditorCanvas,
	type EditorCanvasHandle,
} from "@/editor/canvas/EditorCanvas";
import { CropTool } from "@/editor/crop/CropTool";
import { LayersPanel } from "@/editor/panels/LayersPanel";
import { TextEditor } from "@/editor/panels/TextEditor";
import { TextEditPanel } from "@/editor/panels/TextEditPanel";
import type { Shortcut } from "@/editor/shortcuts";
import { useEditorShortcuts } from "@/editor/useEditorShortcuts";
import { assertNever } from "@/lib/assertNever";
import { defaultTextStyle, type TextAlign } from "@/model/document";
import { useAutosave } from "@/projects/projects";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { ToolButton } from "@/ui/ToolButton";

export default function EditorRoute() {
	const router = useRouter();
	const document = useStore((state) => state.document);
	const projectId = useStore((state) => state.projectId);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
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
			? "This photo couldn't be saved, so your edits won't be kept."
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

	return (
		<View style={styles.container}>
			<ScreenHeader
				onBack={() => {
					canvasRef.current?.flushPendingTransform();
					router.back();
				}}
				action={
					<View style={styles.headerActions}>
						<IconButton
							icon="layers-outline"
							label="Layers"
							selected={layersOpen}
							onPress={() => setLayersOpen((open) => !open)}
						/>
						<IconButton
							icon="arrow-undo-outline"
							label="Undo"
							disabled={!canUndo}
							onPress={handleUndo}
						/>
						<IconButton
							icon="arrow-redo-outline"
							label="Redo"
							disabled={!canRedo}
							onPress={handleRedo}
						/>
						<TextButton
							label="Export"
							tone="accent"
							onPress={() => router.push("/export")}
						/>
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
				/>
				{saveProblem && (
					<View style={styles.saveError}>
						<Text style={styles.saveErrorText}>{saveProblem}</Text>
						{projectId !== null && (
							<Button label="Retry Save" onPress={retryAutosave} />
						)}
					</View>
				)}
			</View>

			<View style={[styles.bottomPanel, layersOpen && styles.layersPanel]}>
				{layersOpen ? (
					<LayersPanel
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
				) : selectedTextLayer ? (
					<TextEditPanel
						layer={selectedTextLayer}
						onChange={updateSelectedText}
						onDuplicate={duplicateSelectedLayer}
						onDelete={() => deleteLayer(selectedTextLayer.id)}
					/>
				) : (
					<View style={styles.toolbar}>
						<ToolButton
							label="Text"
							icon="format-text"
							onPress={() => setEditing("new")}
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
		gap: 24,
	},
	canvasArea: {
		flex: 1,
	},
	// Over the canvas rather than above it, so showing it doesn't resize the
	// canvas mid-gesture.
	saveError: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: colors.surface,
	},
	saveErrorText: {
		flex: 1,
		color: colors.textPrimary,
	},
	// Toolbar and text panel share one fixed height so the canvas above never
	// resizes when the selection changes.
	bottomPanel: {
		height: 120,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	// Pushes the canvas up rather than covering it, so the whole photo stays in
	// view while layers are rearranged. A little over four rows tall, which
	// hints that longer lists scroll.
	layersPanel: {
		height: 256,
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
