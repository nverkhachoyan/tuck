import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { MAX_PHOTO_PIXELS, photoScale } from "./photoScale";

export type PickedPhoto = { uri: string; width: number; height: number };

export type PickPhotoResult =
	| { status: "picked"; photo: PickedPhoto }
	| { status: "canceled" };

export type PickPhotoOptions = {
	// Shrinks the photo so its shorter side is at most this many pixels.
	maxShortSide?: number;
};

/**
 * Lets the user pick a photo, re-encoded so the editor can always read it.
 * The system picker runs outside the app and returns only what the user
 * chooses, so no library permission is needed. Pure IO — no UI feedback here,
 * so callers decide how to react to each outcome. Throws if the photo can't
 * be read or re-encoded.
 */
export async function pickPhoto({
	maxShortSide,
}: PickPhotoOptions = {}): Promise<PickPhotoResult> {
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		quality: 1,
	});
	if (result.canceled) {
		return { status: "canceled" };
	}

	const { uri, width, height } = await reencodeAsJpeg(
		result.assets[0].uri,
		maxShortSide,
	);
	return { status: "picked", photo: { uri, width, height } };
}

// Looks the same as 1, at about half the size on disk. Export uses 0.95.
const JPEG_QUALITY = 0.92;

/**
 * iOS photos are HEIC by default, which Skia's image codec cannot decode —
 * re-encoding here guarantees the editor can always load what the picker
 * returns, regardless of source format. Oversized photos shrink on the way.
 */
async function reencodeAsJpeg(uri: string, maxShortSide?: number) {
	let image = await ImageManipulator.manipulate(uri).renderAsync();
	// The rendered size already has the photo's EXIF rotation applied.
	const scale = photoScale(image, MAX_PHOTO_PIXELS, maxShortSide);
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
