import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { HeaderButton } from "@/components/ui/HeaderButton";
import { getFontSizeRange } from "@/document/document";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { useEditor } from "@/editor/state/EditorProvider";
import { TextEditPanel } from "@/editor/TextEditPanel";
import { BOTTOM_PANEL_HEIGHT, colors } from "@/theme";

export default function EditorRoute() {
	const editor = useEditor();
	const router = useRouter();
	const { doc, selectedLayer } = editor;

	// The stack guard unmounts this route once the document closes.
	if (!doc) return null;

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<HeaderButton label="Back" onPress={editor.closeDocument} />
			</View>

			<View style={styles.canvasArea}>
				<EditorCanvas
					document={doc}
					selectedLayerId={selectedLayer?.id ?? null}
					onSelectLayer={editor.selectLayer}
					onCommitTransform={(transform) =>
						editor.updateSelectedLayer({ transform })
					}
				/>
			</View>

			{selectedLayer ? (
				<TextEditPanel
					layer={selectedLayer}
					fontSizeRange={getFontSizeRange(doc)}
					onChangeText={(text) => editor.updateSelectedLayer({ text })}
					onChangeFontSize={(fontSize) =>
						editor.updateSelectedLayer({ fontSize })
					}
					onChangeColor={(color) => editor.updateSelectedLayer({ color })}
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
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	canvasArea: {
		flex: 1,
		padding: 16,
	},
	toolbar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		height: BOTTOM_PANEL_HEIGHT,
		paddingHorizontal: 20,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
});
