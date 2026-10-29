import type { SkImage } from "react-native-skia";
import { type ExportFormat, encodeImage, exportFormats } from "./exportFormat";
import type { SaveImageResult } from "./saveImage";

// Browsers can't reach the photo library or write files, so saving downloads
// the image and sharing hands the Web Share API a file.
//
// Both must reach the browser API without awaiting anything first: downloads
// and `navigator.share` need the user's tap to still count as the cause.

// Not "to Downloads": the browser may ask where, or save somewhere else.
export const saveLabels = {
	idle: "Download",
	busy: "Preparing…",
	done: "Downloaded",
};

export async function saveImage(
	image: SkImage,
	format: ExportFormat,
): Promise<SaveImageResult> {
	const url = URL.createObjectURL(
		new Blob([encode(image, format)], { type: exportFormats[format].mimeType }),
	);
	const link = window.document.createElement("a");
	link.href = url;
	link.download = fileName(format);
	link.click();
	// The download has taken its copy once the click has been handled.
	setTimeout(() => URL.revokeObjectURL(url), 0);
	return { status: "saved" };
}

/** Whether this browser can share files (not only links), e.g. mobile Safari. */
export function canShareImages(): boolean {
	if (typeof navigator === "undefined" || !navigator.canShare) return false;
	return navigator.canShare({
		files: [new File([], "test.jpg", { type: "image/jpeg" })],
	});
}

export async function shareImage(
	image: SkImage,
	format: ExportFormat,
): Promise<boolean> {
	if (!canShareImages()) return false;
	const file = new File([encode(image, format)], fileName(format), {
		type: exportFormats[format].mimeType,
	});
	try {
		await navigator.share({ files: [file] });
	} catch (error) {
		// Closing the share sheet rejects; that's the user's choice, not a failure.
		if (error instanceof DOMException && error.name === "AbortError") {
			return true;
		}
		throw error;
	}
	return true;
}

function encode(image: SkImage, format: ExportFormat) {
	// CanvasKit copies the bytes into a plain ArrayBuffer; Skia's type only
	// says ArrayBufferLike, which Blob won't take since it could be shared.
	return encodeImage(image, format) as Uint8Array<ArrayBuffer>;
}

function fileName(format: ExportFormat) {
	return `photo-${Date.now()}.${exportFormats[format].extension}`;
}
