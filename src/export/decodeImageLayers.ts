import type { SkImage } from "@shopify/react-native-skia";
import type { HeldImage, ImageCache } from "../layers/imageCache.ts";
import type { Layer } from "../model/document.ts";

export type DecodedImageLayers = {
	images: Map<string, SkImage>;
	release: () => void;
};

/**
 * Holds every visible image layer's decoded image from `cache`, decoding only
 * those nobody else holds. If any decode fails, the images already held are
 * released before the error is returned.
 */
export async function decodeImageLayers(
	layers: Layer[],
	cache: ImageCache,
): Promise<DecodedImageLayers> {
	const images = new Map<string, SkImage>();
	const held: HeldImage[] = [];
	const release = () => {
		for (const image of held.splice(0)) image.release();
	};

	try {
		for (const layer of layers) {
			if (layer.type !== "image" || layer.hidden) continue;
			const image = cache.acquire(layer.uri);
			held.push(image);
			images.set(layer.id, await image.decoded);
		}
		return { images, release };
	} catch (error) {
		release();
		throw error;
	}
}
