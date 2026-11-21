import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { colors } from "@/ui/theme";

/**
 * Shown by the editor's route while CanvasKit, the editor screen, the project,
 * or the text fonts are still loading. Imports no Skia so the route can show
 * it before CanvasKit is ready.
 */
export function EditorOpening() {
	const router = useRouter();
	return (
		<View role="main" style={styles.container}>
			<ScreenHeader
				backLabel="Back to projects"
				onBack={() => leaveEditor(router)}
			/>
			<View style={styles.status}>
				<ActivityIndicator color={colors.textSecondary} />
			</View>
		</View>
	);
}

/**
 * Leaves the editor for the projects screen. Opened from a link or a reload,
 * there's nothing behind the editor; the welcome screen still ends the session.
 */
export function leaveEditor(router: ReturnType<typeof useRouter>) {
	if (router.canGoBack()) router.back();
	else router.replace("/");
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	status: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
});
