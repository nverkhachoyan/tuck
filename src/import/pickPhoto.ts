import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; width: number; height: number };

export type PickPhotoResult =
	| { status: "picked"; photo: PickedPhoto }
	| { status: "canceled" };

/**
 * Lets the user pick a photo, re-encoded so the editor can always read it.
 * The system picker runs outside the app and returns only what the user
 * chooses, so no library permission is needed. Pure IO — no UI feedback here,
 * so callers decide how to react to each outcome. Throws if the photo can't
 * be read or re-encoded.
 */
export async function pickPhoto(): Promise<PickPhotoResult> {
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		quality: 1,
	});
	if (result.canceled) {
		return { status: "canceled" };
	}

	const { uri, width, height } = await reencodeAsJpeg(result.assets[0].uri);
	return { status: "picked", photo: { uri, width, height } };
}

// Larger photos are scaled down to this many pixels. The editor and export
// each hold the photo decoded in full, so 48MP and larger camera modes can run
// a phone out of memory; iPhone's default 24MP photos fit as they are.
const MAX_PHOTO_PIXELS = 24_000_000;

// Looks the same as 1, at about half the size on disk. Export uses 0.95.
const JPEG_QUALITY = 0.92;

/**
 * iOS photos are HEIC by default, which Skia's image codec cannot decode —
 * re-encoding here guarantees the editor can always load what the picker
 * returns, regardless of source format. Oversized photos shrink on the way.
 */
async function reencodeAsJpeg(uri: string) {
	let image = await ImageManipulator.manipulate(uri).renderAsync();
	// The rendered size already has the photo's EXIF rotation applied.
	const scale = Math.sqrt(MAX_PHOTO_PIXELS / (image.width * image.height));
	if (scale < 1) {
		const full = image;
		image = await ImageManipulator.manipulate(full)
			.resize({ width: Math.floor(full.width * scale) })
			.renderAsync();
		full.release();
	}
	try {
		return await image.saveAsync({
			format: SaveFormat.JPEG,
			compress: JPEG_QUALITY,
		});
	} finally {
		image.release();
	}
}
