import type { SkImage } from "@shopify/react-native-skia";
import type { Layer } from "../model/document.ts";

export type DecodedImageLayers = {
	images: Map<string, SkImage>;
	dispose: () => void;
};

/**
 * Decodes every visible image layer, sharing one decoded image between layers
 * with the same URI. If any decode fails, images already loaded are freed
 * before the error is returned.
 */
export async function decodeImageLayers(
	layers: Layer[],
	decode: (uri: string) => Promise<SkImage>,
): Promise<DecodedImageLayers> {
	const images = new Map<string, SkImage>();
	const imagesByUri = new Map<string, SkImage>();
	const dispose = () => {
		for (const image of imagesByUri.values()) image.dispose();
		imagesByUri.clear();
	};

	try {
		for (const layer of layers) {
			if (layer.type !== "image" || layer.hidden) continue;
			let image = imagesByUri.get(layer.uri);
			if (!image) {
				image = await decode(layer.uri);
				imagesByUri.set(layer.uri, image);
			}
			images.set(layer.id, image);
		}
		return { images, dispose };
	} catch (error) {
		dispose();
		throw error;
	}
}
