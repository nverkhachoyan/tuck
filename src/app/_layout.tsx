import { Slot } from "expo-router";
import { Suspense } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AsyncSkia } from "@/components/async-skia";
import { EditorProvider } from "@/features/editor/state/EditorProvider";

export default function Layout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<Suspense fallback={null}>
					<AsyncSkia />
					<EditorProvider>
						<Slot />
					</EditorProvider>
				</Suspense>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
