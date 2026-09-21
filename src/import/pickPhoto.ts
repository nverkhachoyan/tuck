import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { createDocumentFromImage, type EditorDocument } from "@/model/document";

export type PickPhotoResult =
	| { status: "picked"; document: EditorDocument }
	| { status: "canceled" }
	| { status: "permission-denied" };

/**
 * Prompts for media-library access, lets the user pick a photo, and builds
 * an EditorDocument from it. Pure IO + data shaping — no UI feedback here,
 * so callers decide how to react to each outcome (e.g. an Alert).
 */
export async function pickPhotoDocument(): Promise<PickPhotoResult> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
	if (!permission.granted) {
		return { status: "permission-denied" };
	}

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
