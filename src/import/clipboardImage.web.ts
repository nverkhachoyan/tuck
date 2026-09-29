/**
 * The clipboard's first image, as a URL the importer can read, or null when
 * it holds none. The browser may ask the user first; a refusal throws.
 */
export async function pasteClipboardImage(): Promise<string | null> {
	if (!navigator.clipboard?.read) {
		throw new Error("This browser can't read images from the clipboard.");
	}
	for (const item of await navigator.clipboard.read()) {
		const type = item.types.find((candidate) => candidate.startsWith("image/"));
		if (type) return URL.createObjectURL(await item.getType(type));
	}
	return null;
}
