import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import * as Font from "expo-font";
import { type ErrorBoundaryProps, Stack } from "expo-router";
import Head from "expo-router/head";
import { Suspense, use } from "react";
import { Platform, StatusBar, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LoadFonts, resetFailedFonts } from "@/layers/fonts";
import { errorMessage } from "@/lib/errorMessage";
import { colors, fonts, typography } from "@/theme";
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
					<LoadDisplayFonts />
					<StatusBar barStyle="light-content" />
					{/* Screens pad their own bottom, so a bar or sheet there can reach
					    under the home indicator. */}
					<SafeAreaView
						edges={["top", "left", "right"]}
						style={styles.container}
					>
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

let displayFonts: Promise<void> | null = null;

/**
 * Suspends until the wordmark's and titles' typeface loads, so they don't
 * swap faces as the app appears. If it can't load, the system font stands
 * in: not worth stopping the app for.
 */
function LoadDisplayFonts() {
	// No fonts to load while exporting the static site in Node.
	if (typeof window === "undefined") return null;

	displayFonts ??= Font.loadAsync({
		[fonts.display]: InstrumentSerif_400Regular,
		[fonts.displayItalic]: InstrumentSerif_400Regular_Italic,
	}).catch((error: unknown) => {
		console.warn("Couldn't load the display font", error);
	});
	use(displayFonts);
	return null;
}

function Routes() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen name="create" />
			<Stack.Screen name="projects/[id]/index" />
			{/* A sheet over the editor, which stays in view behind it. */}
			<Stack.Screen
				name="projects/[id]/export"
				options={{
					presentation: "containedTransparentModal",
					animation: "fade",
					contentStyle: { backgroundColor: "transparent" },
				}}
			/>
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
		...typography.title,
		color: colors.textPrimary,
	},
	failureMessage: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
		marginBottom: 12,
	},
});
