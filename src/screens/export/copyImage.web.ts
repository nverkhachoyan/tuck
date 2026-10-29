import { ImageFormat, type SkImage } from "react-native-skia";

/** Copies PNG even when the chosen export format is JPEG. */
export function copyImage(image: SkImage): Promise<void> {
	if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
		throw new Error("Copying images isn't supported in this browser.");
	}
	// Construct this in the click's synchronous turn: Safari otherwise rejects
	// clipboard writes. The blob itself may resolve immediately afterwards.
	const bytes = image.encodeToBytes(ImageFormat.PNG) as Uint8Array<ArrayBuffer>;
	const item = new ClipboardItem({
		"image/png": Promise.resolve(new Blob([bytes], { type: "image/png" })),
	});
	return navigator.clipboard.write([item]);
}
