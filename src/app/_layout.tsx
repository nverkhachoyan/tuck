import { Stack } from "expo-router";
import { Suspense } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LoadFonts } from "@/layers/fonts";
import { useStore } from "@/store";
import { colors } from "@/theme";

export default function Layout() {
	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<Suspense fallback={null}>
					<LoadFonts />
					<StatusBar barStyle="light-content" />
					<SafeAreaView style={styles.container}>
						<Routes />
					</SafeAreaView>
				</Suspense>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

function Routes() {
	const hasDocument = useStore((state) => state.document !== null);

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Protected guard={hasDocument}>
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
