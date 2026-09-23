import {
	type SkImage,
	Skia,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import type { ImageLayer } from "@/model/document";

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
 * Draws an already-decoded image layer in its own space, centered on the
 * origin. Callers position it with the layer's transform.
 */
export function ImageLayerView({
	layer,
	image,
}: {
	layer: ImageLayer;
	image: SkImage;
}) {
	return (
		<SkiaImage
			image={image}
			x={-layer.width / 2}
			y={-layer.height / 2}
			width={layer.width}
			height={layer.height}
			fit="fill"
		/>
	);
}
