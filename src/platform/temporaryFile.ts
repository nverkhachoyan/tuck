import { File, Paths } from "expo-file-system";

// `temporaryFile.web.ts` does the same in browsers.

/**
 * A PNG's bytes as a new file in the cache, to hand on: a project moves it
 * into its own folder.
 */
export function writeTemporaryPng(bytes: Uint8Array): string {
	const file = new File(
		Paths.cache,
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`,
	);
	file.create({ overwrite: true });
	file.writeSync(bytes);
	return file.uri;
}

/** Deletes a file nothing needs any more, if it's still there. */
export function deleteTemporaryFile(uri: string) {
	const file = new File(uri);
	if (file.exists) file.delete();
}
