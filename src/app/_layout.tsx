import { type ErrorBoundaryProps, Stack } from "expo-router";
import Head from "expo-router/head";
import { Suspense } from "react";
import { Platform, StatusBar, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LoadFonts, resetFailedFonts } from "@/layers/fonts";
import { errorMessage } from "@/lib/errorMessage";
import { useStore } from "@/store";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";

export default function Layout() {
	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				{/* The browser tab's title. Only on web: in an iOS build, Head also
				    registers the screen with Handoff and Spotlight. */}
				{Platform.OS === "web" && (
					<Head>
						<title>Tuck</title>
					</Head>
				)}
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

/**
 * Replaces the whole app when rendering fails, as when the text fonts can't
 * load. Retrying renders the layout again, loading the fonts afresh if they
 * failed. It stands in for the layout, so it can't use the layout's
 * providers; Expo Router's root provides the safe area.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
	const handleRetry = () => {
		resetFailedFonts();
		void retry();
	};

	return (
		<SafeAreaView style={[styles.container, styles.failure]}>
			<StatusBar barStyle="light-content" />
			<Text style={styles.failureTitle}>Something went wrong</Text>
			<Text style={styles.failureMessage}>{errorMessage(error)}</Text>
			<Button label="Try Again" onPress={handleRetry} />
		</SafeAreaView>
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
			<Stack.Screen name="create" />
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
	failure: {
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 24,
	},
	failureTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	failureMessage: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
		marginBottom: 12,
	},
});
