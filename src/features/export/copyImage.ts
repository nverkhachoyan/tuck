import { ImageFormat, type SkImage } from "@shopify/react-native-skia";
import * as Clipboard from "expo-clipboard";

/** Copies an export as PNG, the image format apps accept most reliably. */
export function copyImage(image: SkImage): Promise<void> {
	return Clipboard.setImageAsync(image.encodeToBase64(ImageFormat.PNG));
}
