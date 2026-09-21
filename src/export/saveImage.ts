import { ImageFormat, type SkImage } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

export type SaveToPhotosResult =
	| { status: "saved" }
	| { status: "permission-denied" };

/**
 * Adds a rendered image to the user's photo library. Asks only for add-only
 * access: saving never needs to read the library. `Asset.create` checks the
 * permission but won't prompt for it, so the request has to come first.
 */
export async function saveToPhotos(
	image: SkImage,
): Promise<SaveToPhotosResult> {
	const permission = await MediaLibrary.requestPermissionsAsync(true, [
		"photo",
	]);
	if (!permission.granted) {
		return { status: "permission-denied" };
	}

	await MediaLibrary.Asset.create(writeJpeg(image).uri);
	return { status: "saved" };
}

/**
 * Encodes a rendered image as JPEG and opens the system share sheet. Returns
 * false when sharing isn't available on this platform.
 */
export async function shareImage(image: SkImage): Promise<boolean> {
	if (!(await Sharing.isAvailableAsync())) return false;

	await Sharing.shareAsync(writeJpeg(image).uri, {
		mimeType: "image/jpeg",
		UTI: "public.jpeg",
	});
	return true;
}

function writeJpeg(image: SkImage): File {
	const file = new File(Paths.cache, `export-${Date.now()}.jpg`);
	file.create({ overwrite: true });
	file.write(image.encodeToBytes(ImageFormat.JPEG, 95));
	return file;
}
