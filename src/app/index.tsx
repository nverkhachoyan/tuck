import { useRouter } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEditorContext } from "@/contexts/editor";
import { EditorScreen } from "@/features/editor/EditorScreen";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { colors } from "@/theme";

export default function Page() {
	const editor = useEditorContext();
	const router = useRouter();

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" />
			{editor.doc ? (
				<EditorScreen
					document={editor.doc}
					selectedLayer={editor.selectedLayer}
					onSelectLayer={editor.selectLayer}
					onBack={editor.closeDocument}
					onAddText={editor.addTextLayer}
					onExport={() => router.navigate("/export")}
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
