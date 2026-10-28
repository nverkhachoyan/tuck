// Both `preferenceStore` files tell this module when they write a key, so
// `usePreference` can share one value between every caller of the key.

const versions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

/** How many times `key` has been written this session. */
export function preferenceVersion(key: string): number {
	return versions.get(key) ?? 0;
}

/** Calls `listener` after each write of `key`, until the returned cleanup. */
export function subscribePreference(key: string, listener: () => void) {
	let keyListeners = listeners.get(key);
	if (!keyListeners) {
		keyListeners = new Set();
		listeners.set(key, keyListeners);
	}
	keyListeners.add(listener);
	return () => {
		keyListeners.delete(listener);
	};
}

/** Called by the stores once `key` is written. */
export function preferenceChanged(key: string) {
	versions.set(key, preferenceVersion(key) + 1);
	for (const listener of [...(listeners.get(key) ?? [])]) listener();
}
