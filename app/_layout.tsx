import { Slot } from "expo-router";
import { Suspense } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AsyncSkia } from "../components/async-skia";

export default function Layout() {
	return (
		<SafeAreaProvider>
			<Suspense fallback={null}>
				<AsyncSkia />
				<Slot />
			</Suspense>
		</SafeAreaProvider>
	);
}
