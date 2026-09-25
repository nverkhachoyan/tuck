import { useEffect, useRef, useState } from "react";
import { readPreference, writePreference } from "./preferenceStore";

/**
 * State kept between sessions under `key`, like `useState`. It starts from
 * what was saved, through `parse`, which must make a valid value of
 * anything: nothing saved, an older build's shape, or a damaged file. Each
 * change is saved.
 */
export function usePreference<T>(key: string, parse: (saved: unknown) => T) {
	const [value, setValue] = useState(() => parse(readPreference(key)));
	// What's saved already, so opening the screen doesn't write it back.
	const saved = useRef(value);
	useEffect(() => {
		if (value === saved.current) return;
		saved.current = value;
		writePreference(key, value);
	}, [key, value]);
	return [value, setValue] as const;
}
