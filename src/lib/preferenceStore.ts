import { File, Paths } from "expo-file-system";

// `preferenceStore.web.ts` keeps them in the browser's localStorage. On
// native, they're one small JSON file, read once and then kept in memory.

const preferencesFile = () => new File(Paths.document, "preferences.json");

let preferences: Record<string, unknown> | null = null;

function loadPreferences(): Record<string, unknown> {
	if (!preferences) {
		try {
			const file = preferencesFile();
			const saved: unknown = file.exists ? JSON.parse(file.textSync()) : {};
			preferences =
				saved && typeof saved === "object" && !Array.isArray(saved)
					? (saved as Record<string, unknown>)
					: {};
		} catch {
			// A file that can't be read or parsed only loses the preferences.
			preferences = {};
		}
	}
	return preferences;
}

/**
 * What was last saved under `key`, or undefined. It isn't checked: it may
 * come from an older build, so callers validate it.
 */
export function readPreference(key: string): unknown {
	return loadPreferences()[key];
}

/** Saves `value`, as JSON, under `key`. If it can't be, it's only lost. */
export function writePreference(key: string, value: unknown) {
	preferences = { ...loadPreferences(), [key]: value };
	try {
		preferencesFile().write(JSON.stringify(preferences));
	} catch {
		// Kept in memory for this session anyway.
	}
}
