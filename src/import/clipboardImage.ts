import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";

/** Checks without triggering iOS's paste permission prompt. */
export function hasClipboardImage(): Promise<boolean> {
	return Clipboard.hasImageAsync();
}

/**
 * Reads an image only on the user's tap, which is when iOS may ask permission,
 * and gives the importer a temporary PNG file to re-encode for the editor.
 */
export async function pasteClipboardImage(): Promise<string | null> {
	const image = await Clipboard.getImageAsync({ format: "png" });
	if (!image) return null;
	const file = new File(Paths.cache, `clipboard-${Date.now()}.png`);
	file.write(image.data.replace(/^data:image\/png;base64,/, ""), {
		encoding: "base64",
	});
	return file.uri;
}
