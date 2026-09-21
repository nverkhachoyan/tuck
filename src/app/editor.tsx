import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { useEditor } from "@/editor/state/EditorProvider";
import { TextEditor } from "@/editor/TextEditor";
import { TextEditPanel } from "@/editor/TextEditPanel";
import {
	defaultTextStyle,
	getFontSizeRange,
	type TextAlign,
} from "@/model/document";
import { colors } from "@/theme";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { ToolButton } from "@/ui/ToolButton";

export default function EditorRoute() {
	const editor = useEditor();
	const router = useRouter();
	const { document, selectedTextLayer } = editor;
	// What the full-screen text editor is open for: a layer that doesn't exist
	// yet, or the selected one. The layer is only created or changed on Done.
	const [editing, setEditing] = useState<"new" | "selected" | null>(null);

	// Leaving by any route (Back, iOS swipe, Android back) discards the edits,
	// so ask first once there's anything to lose. The photo alone isn't an edit.
	const navigation = useNavigation();
	const hasEdits = (document?.layers.length ?? 0) > 1;
	usePreventRemove(hasEdits, ({ data }) => {
		Alert.alert("Discard edits?", "Your changes to this photo will be lost.", [
			{ text: "Keep Editing", style: "cancel" },
			{
				text: "Discard",
				style: "destructive",
				onPress: () => navigation.dispatch(data.action),
			},
		]);
	});

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	// Finishing with no text discards a new layer and deletes an existing one.
	const handleEditDone = (rawText: string, align: TextAlign) => {
		const text = rawText.trim();
		if (editing === "new") {
			if (text) editor.addTextLayer(text, align);
		} else if (text) {
			editor.updateSelectedText({ text, align });
		} else {
			editor.deleteSelectedLayer();
		}
		setEditing(null);
	};

	return (
		<View style={styles.container}>
			<ScreenHeader
				onBack={() => router.back()}
				action={
					<TextButton
						label="Export"
						tone="accent"
						onPress={() => router.push("/export")}
					/>
				}
			/>

			<View style={styles.canvasArea}>
				<EditorCanvas
					document={document}
					selectedLayerId={selectedTextLayer?.id ?? null}
					hiddenLayerId={
						editing === "selected" ? (selectedTextLayer?.id ?? null) : null
					}
					onSelectLayer={editor.selectLayer}
					// Like most story editors, tapping selected text edits it.
					onTapSelectedLayer={() => setEditing("selected")}
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
						onChangeFontSize={(fontSize) =>
							editor.updateSelectedText({ fontSize })
						}
						onChangeColor={(color) => editor.updateSelectedText({ color })}
						onChangeOutlineColor={(outlineColor) =>
							editor.updateSelectedText({ outlineColor })
						}
						onDuplicate={editor.duplicateSelectedText}
						onDelete={editor.deleteSelectedLayer}
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
