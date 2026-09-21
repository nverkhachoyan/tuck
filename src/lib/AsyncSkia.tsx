// Helper to ensure Skia loads or throws inside of React Suspense on web.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { use } from "react";

let skiaPromise: Promise<void> | null = null;

function loadSkia() {
	if (!skiaPromise) {
		skiaPromise = LoadSkiaWeb({
			locateFile: (file) => `/${file}`,
		});
	}
	return skiaPromise;
}

export function AsyncSkia() {
	// CanvasKit is browser-only. Expo renders routes in Node when exporting a
	// static site, where loading the WASM would resolve relative to its server
	// bundle instead of the public directory.
	if (typeof window === "undefined") return null;

	use(loadSkia());
	return null;
}
