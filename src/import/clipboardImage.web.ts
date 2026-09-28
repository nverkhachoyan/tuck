/** The browser home screen already accepts pasted images through usePhotoDrop. */
export async function hasClipboardImage(): Promise<boolean> {
	return false;
}

export async function pasteClipboardImage(): Promise<string | null> {
	return null;
}
