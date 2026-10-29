import { ImageFormat, type SkImage } from "react-native-skia";
import { type EditorDocument, hasTransparency } from "@/editor/core";

export type ExportFormat = "jpeg" | "png";

export const exportFormats = {
	jpeg: {
		label: "JPEG",
		extension: "jpg",
		mimeType: "image/jpeg",
		uti: "public.jpeg",
	},
	png: {
		label: "PNG",
		extension: "png",
		mimeType: "image/png",
		uti: "public.png",
	},
} as const;

/**
 * JPEG, unless some of the canvas is transparent: JPEG can't keep that, and
 * PNG files are several times larger.
 */
export function exportFormatFor(document: EditorDocument): ExportFormat {
	return hasTransparency(document) ? "png" : "jpeg";
}

export function encodeImage(image: SkImage, format: ExportFormat) {
	return format === "png"
		? image.encodeToBytes(ImageFormat.PNG)
		: image.encodeToBytes(ImageFormat.JPEG, 95);
}
