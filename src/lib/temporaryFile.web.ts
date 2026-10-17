/** A PNG's bytes as a blob URL, to hand on: a project copies it. */
export function writeTemporaryPng(bytes: Uint8Array): string {
	return URL.createObjectURL(
		new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }),
	);
}

/** Frees a blob URL nothing needs any more. */
export function deleteTemporaryFile(uri: string) {
	if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}
