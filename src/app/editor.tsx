import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { EditorCanvas, type EditorCanvasHandle } from "@/editor/EditorCanvas";
import { LayersPanel } from "@/editor/LayersPanel";
import { TextEditor } from "@/editor/TextEditor";
import { TextEditPanel } from "@/editor/TextEditPanel";
import { useDiscardGuard } from "@/editor/useDiscardGuard";
import { useUndoShortcuts } from "@/editor/useUndoShortcuts";
import { defaultTextStyle, type TextAlign } from "@/model/document";
import { useStore } from "@/store";
import {
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedTextLayer,
} from "@/store/editorSlice";
import { colors } from "@/theme";
import { IconButton } from "@/ui/IconButton";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { ToolButton } from "@/ui/ToolButton";

export default function EditorRoute() {
	const router = useRouter();
	const document = useStore((state) => state.document);
	const selectedLayer = useStore(selectSelectedLayer);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const duplicateSelectedLayer = useStore(
		(state) => state.duplicateSelectedLayer,
	);
	const updateSelectedText = useStore((state) => state.updateSelectedText);
	const transformLayer = useStore((state) => state.transformLayer);
	const moveLayer = useStore((state) => state.moveLayer);
	const setLayerHidden = useStore((state) => state.setLayerHidden);
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
	const [layersOpen, setLayersOpen] = useState(false);

	// The photo alone isn't an edit.
	useDiscardGuard((document?.layers.length ?? 0) > 1);

	const handleUndo = useCallback(() => {
		canvasRef.current?.flushPendingTransform();
		undo();
	}, [undo]);
	const handleRedo = useCallback(() => {
		canvasRef.current?.flushPendingTransform();
		redo();
	}, [redo]);

	useUndoShortcuts({
		enabled: editing === null,
		onUndo: handleUndo,
		onRedo: handleRedo,
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

	return (
		<View style={styles.container}>
			<ScreenHeader
				onBack={() => router.back()}
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
				/>
			</View>

			<View style={[styles.bottomPanel, layersOpen && styles.layersPanel]}>
				{layersOpen ? (
					<LayersPanel
						layers={document.layers}
						selectedLayerId={selectedLayer?.id ?? null}
						onSelect={selectLayer}
						onMove={moveLayer}
						onSetHidden={setLayerHidden}
						onDelete={deleteLayer}
					/>
				) : selectedTextLayer ? (
					<TextEditPanel
						layer={selectedTextLayer}
						onChangeColor={(color) => updateSelectedText({ color })}
						onChangeOutlineColor={(outlineColor) =>
							updateSelectedText({ outlineColor })
						}
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
					</View>
				)}
			</View>

			{editing === "new" && (
				<TextEditor
					initialText=""
					initialAlign={defaultTextStyle.align}
					color={defaultTextStyle.color}
					outlineColor={defaultTextStyle.outlineColor}
					onDone={handleEditDone}
				/>
			)}
			{editing === "selected" && selectedTextLayer && (
				<TextEditor
					initialText={selectedTextLayer.text}
					initialAlign={selectedTextLayer.align}
					color={selectedTextLayer.color}
					outlineColor={selectedTextLayer.outlineColor}
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
		padding: 16,
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
