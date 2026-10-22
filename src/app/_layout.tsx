import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { type ErrorBoundaryProps, Stack } from "expo-router";
import { Suspense, useState } from "react";
import { Platform, StatusBar, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { errorMessage } from "@/lib/errorMessage";
import { SUPPORT_EMAIL } from "@/lib/site";
import { LoadFonts, resetFailedFonts } from "@/render/fonts";
import { colorScheme, colors, space, typography } from "@/theme";
import { Button } from "@/ui/Button";
import { PageHead } from "@/ui/PageHead";

const barStyle = colorScheme === "dark" ? "light-content" : "dark-content";

export default function Layout() {
	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<PageHead />
				<Suspense fallback={null}>
					<LoadFonts />
					<StatusBar barStyle={barStyle} />
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
	const [copied, setCopied] = useState(false);
	const handleRetry = () => {
		resetFailedFonts();
		void retry();
	};
	const copyDetails = async () => {
		await Clipboard.setStringAsync(errorDetails(error));
		setCopied(true);
	};

	return (
		<SafeAreaView style={[styles.container, styles.failure]}>
			<StatusBar barStyle={barStyle} />
			<Text style={styles.failureTitle}>Something went wrong</Text>
			<Text style={styles.failureMessage}>{errorMessage(error)}</Text>
			<View style={styles.failureActions}>
				<Button label="Try Again" variant="primary" onPress={handleRetry} />
				<Button
					label={copied ? "Copied" : "Copy Details"}
					icon={copied ? "checkmark" : "copy-outline"}
					onPress={() => void copyDetails()}
				/>
			</View>
			<Text style={styles.failureHint}>
				If it keeps happening, email the details to {SUPPORT_EMAIL}.
			</Text>
		</SafeAreaView>
	);
}

/**
 * What support needs to look into a crash, for the user to paste into an
 * email. Tuck sends nothing itself.
 */
function errorDetails(error: Error): string {
	return [
		`Tuck ${Constants.expoConfig?.version ?? ""}`,
		Platform.OS === "web"
			? `${navigator.userAgent}\n${window.location.pathname}`
			: `${Platform.OS} ${Platform.Version}`,
		error.stack ?? `${error.name}: ${error.message}`,
	].join("\n");
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
			<Stack.Screen name="settings" />
			<Stack.Screen name="support" />
			<Stack.Screen name="privacy" />
			<Stack.Screen name="licenses" />
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
	failureActions: {
		flexDirection: "row",
		gap: space.xs,
	},
	failureHint: {
		...typography.label,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
		marginTop: space.xs,
	},
});
