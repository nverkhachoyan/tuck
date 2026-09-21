import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { useEditor } from "@/editor/state/EditorProvider";
import { TextEditPanel } from "@/editor/TextEditPanel";
import { getFontSizeRange } from "@/model/document";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default function EditorRoute() {
	const editor = useEditor();
	const router = useRouter();
	const { document, selectedTextLayer } = editor;
	// Only a freshly added layer opens the keyboard; selecting an existing one
	// is usually about moving it, and the keyboard would hide half the canvas.
	const [addedLayerId, setAddedLayerId] = useState<string | null>(null);
	// Forget it once deselected, so selecting that layer again later doesn't.
	if (addedLayerId && selectedTextLayer?.id !== addedLayerId) {
		setAddedLayerId(null);
	}

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	return (
		// The keyboard overlays the window on both platforms (iOS never resizes it,
		// and Android is edge-to-edge), so pad it away explicitly. Padding
		// shrinks the canvas, which refits the photo above the text panel.
		<KeyboardAvoidingView behavior="padding" style={styles.container}>
			<ScreenHeader onBack={editor.closeDocument} />

			<View style={styles.canvasArea}>
				<EditorCanvas
					document={document}
					selectedLayerId={selectedTextLayer?.id ?? null}
					onSelectLayer={editor.selectLayer}
					onCommitTransform={(transform) =>
						editor.updateSelectedText({ transform })
					}
				/>
			</View>

			<View style={styles.bottomPanel}>
				{selectedTextLayer ? (
					<TextEditPanel
						layer={selectedTextLayer}
						fontSizeRange={getFontSizeRange(document)}
						autoFocus={selectedTextLayer.id === addedLayerId}
						onChangeText={(text) => editor.updateSelectedText({ text })}
						onChangeFontSize={(fontSize) =>
							editor.updateSelectedText({ fontSize })
						}
						onChangeColor={(color) => editor.updateSelectedText({ color })}
						onDelete={editor.deleteSelectedLayer}
						onDone={editor.deselectLayer}
					/>
				) : (
					<View style={styles.toolbar}>
						<Button
							label="Text"
							onPress={() => setAddedLayerId(editor.addTextLayer())}
						/>
						<Button
							label="Export"
							variant="primary"
							onPress={() => router.push("/export")}
						/>
					</View>
				)}
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
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
	toolbar: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
	},
});
