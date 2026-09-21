import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
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

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	return (
		<View style={styles.container}>
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
						<Button label="Text" onPress={editor.addTextLayer} />
						<Button
							label="Export"
							variant="primary"
							onPress={() => router.push("/export")}
						/>
					</View>
				)}
			</View>
		</View>
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
