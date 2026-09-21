import { StyleSheet, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { HeaderButton } from "../../components/ui/HeaderButton";
import { BOTTOM_PANEL_HEIGHT, colors } from "../../theme";
import { EditorCanvas } from "./canvas/EditorCanvas";
import { TextEditPanel } from "./layers/text/TextEditPanel";
import {
	type EditorDocument,
	getFontSizeRange,
	type TextLayer,
} from "./model/document";
import type { Transform } from "./model/geometry";

type EditorScreenProps = {
	document: EditorDocument;
	selectedLayer: TextLayer | undefined;
	onSelectLayer: (id: string | null) => void;
	onBack: () => void;
	onDone: () => void;
	onAddText: () => void;
	onExport: () => void;
	onChangeText: (text: string) => void;
	onChangeFontSize: (fontSize: number) => void;
	onChangeColor: (color: string) => void;
	onDeleteLayer: () => void;
	onDeselect: () => void;
	onCommitTransform: (transform: Transform) => void;
};

export function EditorScreen({
	document,
	selectedLayer,
	onSelectLayer,
	onBack,
	onDone,
	onAddText,
	onExport,
	onChangeText,
	onChangeFontSize,
	onChangeColor,
	onDeleteLayer,
	onDeselect,
	onCommitTransform,
}: EditorScreenProps) {
	return (
		<View style={styles.editor}>
			<View style={styles.editorHeader}>
				<HeaderButton label="Back" onPress={onBack} />
				<HeaderButton label="Done" accent onPress={onDone} />
			</View>

			<View style={styles.canvasArea}>
				<EditorCanvas
					document={document}
					selectedLayerId={selectedLayer?.id ?? null}
					onSelectLayer={onSelectLayer}
					onCommitTransform={onCommitTransform}
				/>
			</View>

			{selectedLayer ? (
				<TextEditPanel
					layer={selectedLayer}
					fontSizeRange={getFontSizeRange(document)}
					onChangeText={onChangeText}
					onChangeFontSize={onChangeFontSize}
					onChangeColor={onChangeColor}
					onDelete={onDeleteLayer}
					onDone={onDeselect}
				/>
			) : (
				<View style={styles.editorToolbar}>
					<Button label="Text" onPress={onAddText} />
					<Button label="Export" variant="primary" onPress={onExport} />
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	editor: {
		flex: 1,
	},
	editorHeader: {
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
	editorToolbar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		height: BOTTOM_PANEL_HEIGHT,
		paddingHorizontal: 20,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
});
