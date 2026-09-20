import * as ImagePicker from "expo-image-picker";
import {
	createDocumentFromImage,
	type EditorDocument,
} from "./editor-document";
import { normalizePickedImage } from "./normalize-picked-image";

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

	const asset = result.assets[0];
	const normalized = await normalizePickedImage(asset.uri);
	const document = createDocumentFromImage(
		normalized.uri,
		normalized.width,
		normalized.height,
	);
	return { status: "picked", document };
}
