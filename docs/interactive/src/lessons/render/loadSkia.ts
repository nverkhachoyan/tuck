import wasm from "canvaskit-wasm/bin/full/canvaskit.wasm?url";
import { type ComponentType, lazy } from "react";

let loading: Promise<void> | null = null;

/**
 * Loads CanvasKit, Skia's WebAssembly build, as the app's `index.web.ts`
 * does. React Native Skia binds to it the moment its module is first
 * evaluated, so nothing that imports Skia may load before this resolves.
 */
export function loadSkia(): Promise<void> {
	// Imported here, so CanvasKit's script loads with the first rendering
	// lesson rather than the docs.
	loading ??= import("@shopify/react-native-skia/lib/module/web").then(
		({ LoadSkiaWeb }) => LoadSkiaWeb({ locateFile: () => wasm }),
	);
	return loading;
}

/**
 * A lesson whose module imports Skia, loaded only once CanvasKit has. Its
 * import must be dynamic, or the bundler evaluates it with the page.
 */
export function withSkia(
	load: () => Promise<{ default: ComponentType }>,
): ComponentType {
	return lazy(() => loadSkia().then(load));
}
