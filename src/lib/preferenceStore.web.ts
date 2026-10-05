// The browser's counterpart to `preferenceStore.ts`: each preference is a
// JSON string in localStorage. It can be missing (the static export's
// server render) or throw (storage that's full or turned off), and then
// preferences just aren't kept.

const PREFIX = "tuck:";

/**
 * What was last saved under `key`, or undefined. It isn't checked: it may
 * come from an older build, so callers validate it.
 */
export function readPreference(key: string): unknown {
	try {
		const saved = localStorage.getItem(PREFIX + key);
		return saved === null ? undefined : JSON.parse(saved);
	} catch {
		return undefined;
	}
}

/** Saves `value`, as JSON, under `key`. If it can't be, it's only lost. */
export function writePreference(key: string, value: unknown) {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// Not kept, but nothing else depends on it.
	}
}
