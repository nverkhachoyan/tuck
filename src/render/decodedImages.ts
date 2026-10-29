import { type SkImage, Skia } from "react-native-skia";
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
 * Runs `free` two animation frames from now. A Skia canvas draws a scene
 * recorded before its last React update until a frame later: on web its
 * redraw, and the stop of the animation mapper that replays the old
 * recording whenever a shared value changes, both wait for the next frame.
 * An image the update let go of is in that recording, so freeing it any
 * sooner (a timer can fire before the frame) has Skia draw a deleted image.
 * While a page is hidden, frames wait, and so does freeing.
 */
function afterSkiaDraws(free: () => void) {
	requestAnimationFrame(() => requestAnimationFrame(free));
}

/**
 * Image layers' decoded images, one copy per file: the canvas, the crop tool,
 * duplicated photos, and export (while the editor stays mounted under it)
 * all draw the same one.
 */
export const decodedImages = createImageCache(decodeImage, afterSkiaDraws);
