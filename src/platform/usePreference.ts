import { useCallback, useSyncExternalStore } from "react";
import { preferenceVersion, subscribePreference } from "./preferenceChanges";
import { readPreference, writePreference } from "./preferenceStore";

type Parsed = { value: unknown; version: number };

// Each key's parsed value, kept until the key is written: a snapshot must
// keep its identity, or `useSyncExternalStore` renders without end.
const parsed = new Map<string, Parsed>();

function current<T>(key: string, parse: (saved: unknown) => T): T {
	const version = preferenceVersion(key);
	let entry = parsed.get(key);
	if (entry?.version !== version) {
		entry = { value: parse(readPreference(key)), version };
		parsed.set(key, entry);
	}
	return entry.value as T;
}

/**
 * State kept between sessions under `key`, like `useState`, and shared by
 * every caller of the key.
 * - `parse` must make a valid value of anything: nothing saved, an older
 *   build's shape, or a damaged file. A key has one parser.
 * - Each change is saved, and kept for the session even if saving fails.
 */
export function usePreference<T>(key: string, parse: (saved: unknown) => T) {
	const subscribe = useCallback(
		(onChange: () => void) => subscribePreference(key, onChange),
		[key],
	);
	const read = () => current(key, parse);
	const value = useSyncExternalStore(subscribe, read, read);
	const setValue = useCallback(
		(next: T | ((current: T) => T)) => {
			const previous = current(key, parse);
			const value =
				typeof next === "function"
					? (next as (current: T) => T)(previous)
					: next;
			if (value === previous) return;
			// Ready before the write tells subscribers, so they read this value.
			parsed.set(key, { value, version: preferenceVersion(key) + 1 });
			writePreference(key, value);
		},
		[key, parse],
	);
	return [value, setValue] as const;
}
