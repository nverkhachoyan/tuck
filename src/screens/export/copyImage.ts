import * as Clipboard from "expo-clipboard";
import { ImageFormat, type SkImage } from "react-native-skia";

/** Copies an export as PNG, the image format apps accept most reliably. */
export async function copyImage(image: SkImage): Promise<void> {
	await Clipboard.setImageAsync(await image.encodeToBase64(ImageFormat.PNG));
}
