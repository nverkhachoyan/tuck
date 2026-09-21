import { drawAsImage, type SkImage, Skia } from "@shopify/react-native-skia";
import type { EditorDocument } from "@/model/document";
import { ExportScene } from "./ExportScene";

async function decodeImageLayers(document: EditorDocument) {
	const images = new Map<string, SkImage>();
	for (const layer of document.layers) {
		if (layer.type !== "image") continue;
		const data = await Skia.Data.fromURI(layer.uri);
		const image = Skia.Image.MakeImageFromEncoded(data);
		if (!image) {
			throw new Error(`Could not decode image layer ${layer.id}`);
		}
		images.set(layer.id, image);
	}
	return images;
}

/** Renders the document at its full logical resolution (1 unit = 1 pixel). */
export async function renderDocument(
	document: EditorDocument,
): Promise<SkImage> {
	const images = await decodeImageLayers(document);
	try {
		const result = await drawAsImage(
			<ExportScene document={document} images={images} />,
			{ width: document.width, height: document.height },
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
