import {
	drawAsImage,
	Group,
	ImageFormat,
	type SkImage,
	Skia,
} from "@shopify/react-native-skia";
import type { EditorDocument } from "@/model/document";
import { ExportScene } from "./ExportScene";

// A thumbnail's shorter side, in pixels: a list row's image at 3x.
const THUMBNAIL_SIZE = 160;

async function decodeImageLayers(document: EditorDocument) {
	const images = new Map<string, SkImage>();
	for (const layer of document.layers) {
		if (layer.type !== "image" || layer.hidden) continue;
		const data = await Skia.Data.fromURI(layer.uri);
		const image = Skia.Image.MakeImageFromEncoded(data);
		if (!image) {
			throw new Error(`Could not decode image layer ${layer.id}`);
		}
		images.set(layer.id, image);
	}
	return images;
}

/**
 * Renders the document at its full logical resolution (1 unit = 1 pixel), or
 * `scale` times that.
 */
export async function renderDocument(
	document: EditorDocument,
	scale = 1,
): Promise<SkImage> {
	const images = await decodeImageLayers(document);
	try {
		const result = await drawAsImage(
			<Group transform={[{ scale }]}>
				<ExportScene document={document} images={images} />
			</Group>,
			{
				width: Math.round(document.width * scale),
				height: Math.round(document.height * scale),
			},
		);
		if (!result) {
			throw new Error("Could not render exported image");
		}
		return result;
	} finally {
		// Camera photos are large; free the decoded copies right away instead of
		// waiting for garbage collection.
		for (const image of images.values()) image.dispose();
	}
}

/** A small JPEG of the document, as a data URL for a project's thumbnail. */
export async function renderThumbnail(
	document: EditorDocument,
): Promise<string> {
	const shortSide = Math.min(document.width, document.height);
	const image = await renderDocument(
		document,
		Math.min(1, THUMBNAIL_SIZE / shortSide),
	);
	try {
		return `data:image/jpeg;base64,${image.encodeToBase64(ImageFormat.JPEG, 80)}`;
	} finally {
		image.dispose();
	}
}
