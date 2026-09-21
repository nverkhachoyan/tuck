import { Redirect, useRouter } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEditorContext } from "@/contexts/editor";
import { ExportScreen } from "@/features/export/ExportScreen";
import { colors } from "@/theme";

export default function Page() {
	const { doc } = useEditorContext();
	const router = useRouter();

	// Reloads and deep links land here with no document open.
	if (!doc) return <Redirect href="/" />;

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" />
			<ExportScreen document={doc} onBack={() => router.back()} />
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
});
