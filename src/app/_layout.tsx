import { Stack } from "expo-router";
import { Suspense } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AsyncSkia } from "@/components/async-skia";
import {
	EditorProvider,
	useEditor,
} from "@/features/editor/state/EditorProvider";
import { colors } from "@/theme";

export default function Layout() {
	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<Suspense fallback={null}>
					<AsyncSkia />
					<EditorProvider>
						<StatusBar barStyle="light-content" />
						<SafeAreaView style={styles.container}>
							<Routes />
						</SafeAreaView>
					</EditorProvider>
				</Suspense>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

function Routes() {
	const { doc } = useEditor();

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="index" />
			{/* Reloads, deep links, and closing the document all drop these routes. */}
			<Stack.Protected guard={!!doc}>
				<Stack.Screen name="editor" />
				<Stack.Screen name="export" />
			</Stack.Protected>
		</Stack>
	);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
});
