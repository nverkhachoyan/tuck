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

/**
 * iOS photos are HEIC by default, which Skia's image codec cannot decode —
 * re-encoding here guarantees the editor can always load what the picker
 * returns, regardless of source format.
 */
async function reencodeAsJpeg(uri: string) {
	const rendered = await ImageManipulator.manipulate(uri).renderAsync();
	return rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
}
