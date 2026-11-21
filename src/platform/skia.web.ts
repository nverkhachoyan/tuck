let skiaLoaded = false;
let skiaFailed = false;
let skiaPromise: Promise<void> | null = null;
const resetListeners = new Set<() => void>();

/**
 * Loads CanvasKit, Skia's WebAssembly build, once. Safe to call repeatedly.
 * React Native Skia binds to `globalThis.CanvasKit` the moment its module is
 * first evaluated, so anything that imports Skia must await this first.
 */
export function loadSkia(): Promise<void> {
	// Expo renders routes in Node when exporting a static site; there's no
	// browser or CanvasKit there.
	if (typeof window === "undefined") return Promise.resolve();
	if (!skiaPromise) {
		skiaPromise = initSkia()
			.then(() => {
				skiaLoaded = true;
			})
			.catch((error: unknown) => {
				skiaFailed = true;
				throw error;
			});
	}
	return skiaPromise;
}

async function initSkia(): Promise<void> {
	// Reuse the CanvasKit WASM fetch preloaded by +html.tsx before the scripts
	// ran, so CanvasKitInit doesn't trigger a duplicate fetch or cross-world
	// mismatch. Consumed once so a retry fetches afresh.
	const globalWithPreload = globalThis as unknown as {
		__canvaskit?: Promise<Response>;
	};
	const preloaded = globalWithPreload.__canvaskit;
	let restoreFetch: (() => void) | null = null;
	if (preloaded) {
		globalWithPreload.__canvaskit = undefined;
		const originalFetch = globalThis.fetch;
		const restore = () => {
			if (globalThis.fetch === patchedFetch) {
				globalThis.fetch = originalFetch;
			}
		};
		const patchedFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;
			if (url === "/canvaskit.wasm" || url.endsWith("/canvaskit.wasm")) {
				restore();
				return preloaded.then((response) => response.clone());
			}
			return originalFetch(input, init);
		}) as typeof fetch;
		globalThis.fetch = patchedFetch;
		restoreFetch = restore;
	}
	try {
		// Imported dynamically so CanvasKit's JS glue stays out of the initial
		// bundle for pages that draw nothing.
		const { LoadSkiaWeb } = await import("react-native-skia/lib/module/web");
		await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
	} finally {
		restoreFetch?.();
	}
}

/**
 * Starts loading CanvasKit without waiting for it, so pages that draw nothing
 * show at once. A failure is left for routes that need Skia to report.
 */
export function preloadSkia(): void {
	if (typeof window === "undefined") return;
	loadSkia().catch(() => {});
}

/** Whether CanvasKit has finished loading. */
export function isSkiaLoaded(): boolean {
	return skiaLoaded;
}

/** Runs `listener` when the error boundary retries after a failed Skia load. */
export function onResetFailedSkia(listener: () => void): () => void {
	resetListeners.add(listener);
	return () => {
		resetListeners.delete(listener);
	};
}

/**
 * Lets the next `loadSkia` and any failed Skia route try again after a
 * failure. Until then the failed promise stays cached so React's `use`
 * reaches the error boundary rather than suspending in a loop.
 */
export function resetFailedSkia(): void {
	if (skiaFailed) {
		skiaFailed = false;
		skiaPromise = null;
	}
	for (const listener of resetListeners) listener();
}
