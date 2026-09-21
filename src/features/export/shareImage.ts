import { ImageFormat, type SkImage } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Encodes a rendered image as JPEG and opens the system share sheet, which
 * on iOS/Android includes "Save Image". Returns false when sharing isn't
 * available on this platform.
 */
export async function shareImage(image: SkImage): Promise<boolean> {
	if (!(await Sharing.isAvailableAsync())) return false;

	const file = new File(Paths.cache, `export-${Date.now()}.jpg`);
	file.create({ overwrite: true });
	file.write(image.encodeToBytes(ImageFormat.JPEG, 95));

	await Sharing.shareAsync(file.uri, {
		mimeType: "image/jpeg",
		UTI: "public.jpeg",
	});
	return true;
}
