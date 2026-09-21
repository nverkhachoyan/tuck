import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Re-encodes a picked photo to JPEG. iOS photos are HEIC by default, which
 * Skia's image codec cannot decode — re-encoding here guarantees the editor
 * can always load what the picker returns, regardless of source format.
 */
export async function normalizePickedImage(uri: string) {
	const context = ImageManipulator.manipulate(uri);
	const rendered = await context.renderAsync();
	return rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
}
