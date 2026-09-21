import { Alert, StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EditorScreen } from "../features/editor/EditorScreen";
import { useEditor } from "../features/editor/state/useEditor";
import { WelcomeScreen } from "../features/welcome/WelcomeScreen";
import { colors } from "../theme";

const notReady = () =>
	Alert.alert("Coming soon", "This tool isn't wired up yet.");

export default function Page() {
	const editor = useEditor();

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" />
			{editor.doc ? (
				<EditorScreen
					document={editor.doc}
					selectedLayer={editor.selectedLayer}
					onSelectLayer={editor.selectLayer}
					onBack={editor.closeDocument}
					onDone={notReady}
					onAddText={editor.addTextLayer}
					onExport={notReady}
					onChangeText={(text) => editor.updateSelectedLayer({ text })}
					onChangeFontSize={(fontSize) =>
						editor.updateSelectedLayer({ fontSize })
					}
					onChangeColor={(color) => editor.updateSelectedLayer({ color })}
					onDeleteLayer={editor.deleteSelectedLayer}
					onDeselect={editor.deselectLayer}
					onCommitTransform={(transform) =>
						editor.updateSelectedLayer({ transform })
					}
				/>
			) : (
				<WelcomeScreen onPickImage={editor.pickImage} />
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
});
