import { type SkImage, Skia } from "react-native-skia";
import { measurePerfSpan } from "../../platform/perf.ts";
import { createImageCache } from "./imageCache";

/**
 * A photo decoded by the browser, as an image that uploads it straight to
 * the GPU of whatever surface draws it. CanvasKit's own decode keeps the
 * pixels in its WebAssembly heap, which can grow but never shrink, so a
 * few full-size photos for an export held hundreds of megabytes until the
 * tab reloaded. Only a GPU surface can draw this image, and nothing can
 * read its pixels back.
 */
async function decodePhoto(uri: string): Promise<SkImage> {
	return measurePerfSpan("tuck:image-decode", async () => {
		const response = await fetch(uri);
		if (!response.ok) throw new Error("Couldn't read the image.");
		const bitmap = await createImageBitmap(await response.blob(), {
			premultiplyAlpha: "none",
		}).catch(() => {
			throw new Error("Couldn't decode the image.");
		});
		const image = Skia.Image.MakeImageFromNativeBuffer(bitmap);
		// CanvasKit closes only a `VideoFrame` it's handed, not a bitmap.
		const dispose = image.dispose.bind(image);
		image.dispose = () => {
			dispose();
			bitmap.close();
		};
		return image;
	});
}

/** See `offscreenPhotos.ts`. Not shared with the editor's canvas. */
export const offscreenPhotos = createImageCache(decodePhoto);
