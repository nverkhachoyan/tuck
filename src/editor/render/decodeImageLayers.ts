import type { SkImage } from "react-native-skia";
import { type Layer, layerFiles } from "../layers/layer.ts";
import type { HeldImage, ImageCache } from "./imageCache.ts";

export type DecodedImageLayers = {
	// By file: an image layer's `uri` or `mask`, or a masked redaction's
	// `mask`.
	images: Map<string, SkImage>;
	release: () => void;
};

/**
 * Holds every file the visible layers draw (see `layerFiles`) decoded, decoding
 * only those nobody else holds. If any decode fails, the images already held
 * are released before the error is returned.
 * - `cache`: masks, and photos too unless `photos` is given.
 * - `photos`: image layers' photos (`uri`).
 */
export async function decodeImageLayers(
	layers: Layer[],
	cache: ImageCache,
	photos: ImageCache = cache,
): Promise<DecodedImageLayers> {
	const images = new Map<string, SkImage>();
	const held: HeldImage[] = [];
	const release = () => {
		for (const image of held.splice(0)) image.release();
	};

	try {
		for (const layer of layers) {
			if (layer.hidden) continue;
			for (const uri of layerFiles(layer)) {
				if (images.has(uri)) continue;
				const from =
					layer.type === "image" && uri === layer.uri ? photos : cache;
				const image = from.acquire(uri);
				held.push(image);
				images.set(uri, await image.decoded);
			}
		}
		return { images, release };
	} catch (error) {
		release();
		throw error;
	}
}
