import { type SkImage, Skia } from "@shopify/react-native-skia";
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
