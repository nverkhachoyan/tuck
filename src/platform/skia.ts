const resetListeners = new Set<() => void>();

/** Native Skia is linked into the app and ready at launch. */
export function loadSkia(): Promise<void> {
	return Promise.resolve();
}

/** Starts loading Skia in the background; a no-op on native. */
export function preloadSkia(): void {}

/** Whether Skia has finished loading. */
export function isSkiaLoaded(): boolean {
	return true;
}

/** Runs `listener` when the error boundary retries after a failed Skia load. */
export function onResetFailedSkia(listener: () => void): () => void {
	resetListeners.add(listener);
	return () => {
		resetListeners.delete(listener);
	};
}

/** Lets a failed Skia screen load try again on the next render. */
export function resetFailedSkia(): void {
	for (const listener of resetListeners) listener();
}
