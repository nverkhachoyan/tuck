import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { TextEditor } from "@/editor/TextEditor";
import { TextEditPanel } from "@/editor/TextEditPanel";
import { showAlert } from "@/lib/showAlert";
import { defaultTextStyle, type TextAlign } from "@/model/document";
import { useStore } from "@/store";
import { selectSelectedTextLayer } from "@/store/editorSlice";
import { colors } from "@/theme";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { ToolButton } from "@/ui/ToolButton";

export default function EditorRoute() {
	const router = useRouter();
	const document = useStore((state) => state.document);
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const duplicateSelectedText = useStore(
		(state) => state.duplicateSelectedText,
	);
	const updateSelectedText = useStore((state) => state.updateSelectedText);
	const transformLayer = useStore((state) => state.transformLayer);
	const deleteSelectedLayer = useStore((state) => state.deleteSelectedLayer);
	const selectLayer = useStore((state) => state.selectLayer);
	// What the full-screen text editor is open for: a layer that doesn't exist
	// yet, or the selected one. The layer is only created or changed on Done.
	const [editing, setEditing] = useState<"new" | "selected" | null>(null);

	// Leaving by any route (Back, iOS swipe, Android back) discards the edits,
	// so ask first once there's anything to lose. The photo alone isn't an edit.
	const navigation = useNavigation();
	const hasEdits = (document?.layers.length ?? 0) > 1;
	usePreventRemove(hasEdits, ({ data }) => {
		showAlert("Discard edits?", "Your changes to this photo will be lost.", [
			{ text: "Keep Editing", style: "cancel" },
			{
				text: "Discard",
				style: "destructive",
				onPress: () => navigation.dispatch(data.action),
			},
		]);
	});

	// On web, a reload or closing the tab also loses the edits, and no route
	// is removed to catch it; the browser's own leave-page prompt covers it.
	useEffect(() => {
		if (Platform.OS !== "web" || !hasEdits) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [hasEdits]);

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	// Finishing with no text discards a new layer and deletes an existing one.
	const handleEditDone = (rawText: string, align: TextAlign) => {
		const text = rawText.trim();
		if (editing === "new") {
			if (text) addTextLayer(text, align);
		} else if (text) {
			updateSelectedText({ text, align });
		} else {
			deleteSelectedLayer();
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
					onSelectLayer={selectLayer}
					onTapSelectedLayer={() => setEditing("selected")}
					onCommitTransform={transformLayer}
				/>
			</View>

			<View style={styles.bottomPanel}>
				{selectedTextLayer ? (
					<TextEditPanel
						layer={selectedTextLayer}
						onChangeColor={(color) => updateSelectedText({ color })}
						onChangeOutlineColor={(outlineColor) =>
							updateSelectedText({ outlineColor })
						}
						onDuplicate={duplicateSelectedText}
						onDelete={deleteSelectedLayer}
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
