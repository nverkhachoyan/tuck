import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { createDocumentFromImage, type EditorDocument } from "@/model/document";

export type PickPhotoResult =
	| { status: "picked"; document: EditorDocument }
	| { status: "canceled" };

/**
 * Lets the user pick a photo and builds an EditorDocument from it. The system
 * picker runs outside the app and returns only what the user chooses, so no
 * library permission is needed. Pure IO + data shaping — no UI feedback here,
 * so callers decide how to react to each outcome. Throws if the photo can't
 * be read or re-encoded.
 */
export async function pickPhotoDocument(): Promise<PickPhotoResult> {
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		quality: 1,
	});
	if (result.canceled) {
		return { status: "canceled" };
	}

	const photo = await reencodeAsJpeg(result.assets[0].uri);
	const document = createDocumentFromImage(
		photo.uri,
		photo.width,
		photo.height,
	);
	return { status: "picked", document };
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
