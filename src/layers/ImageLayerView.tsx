import {
	Group,
	type SkImage,
	Skia,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import type { ImageLayer } from "@/model/document";
import { createImageCache } from "./imageCache";

/**
 * Reads and decodes an image layer's file. Unlike `useImage`, whose `onError`
 * only covers decoding, this rejects when the file can't be read either.
 */
export async function decodeImage(uri: string): Promise<SkImage> {
	const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
	if (!image) throw new Error("Couldn't decode the image.");
	return image;
}

/**
 * Image layers' decoded images, one copy per file: the canvas, the crop tool,
 * duplicated photos, and export (while the editor stays mounted under it)
 * all draw the same one.
 */
export const decodedImages = createImageCache(decodeImage);

const MIRRORED = [{ scaleX: -1 }];

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin, and mirrored there if it's flipped. Callers position it with the
 * layer's transform.
 */
export function ImageLayerView({
	layer,
	image,
}: {
	layer: ImageLayer;
	image: SkImage;
}) {
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			<SkiaImage
				image={image}
				x={-layer.width / 2}
				y={-layer.height / 2}
				width={layer.width}
				height={layer.height}
				fit="fill"
			/>
		</Group>
	);
}
