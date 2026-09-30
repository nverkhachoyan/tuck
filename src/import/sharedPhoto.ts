import { Directory, File, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { importPhoto, type PickedPhoto } from "./photoImport";

// Where the share extension (iOS) or share activity (Android) in
// `modules/share-target` leaves a photo shared from another app.
const FOLDER = "shared-photos";

// A name those pick, so a link can't reach any other file.
const NAME = /^[\w-]+\.\w+$/;

/**
 * The name of the photo a link to <scheme>://share?file=<name> hands over,
 * or null for any other link.
 */
export function sharedPhotoName(url: string): string | null {
	const { hostname, queryParams } = Linking.parse(url);
	const file = queryParams?.file;
	return hostname === "share" && typeof file === "string" && NAME.test(file)
		? file
		: null;
}

/**
 * A shared photo, made ready for the editor like a picked one. The shared
 * copy is deleted either way. Throws if it's gone or can't be read.
 */
export async function importSharedPhoto(name: string): Promise<PickedPhoto> {
	const folder = sharedFolder();
	const file = folder && NAME.test(name) ? new File(folder, name) : null;
	if (!file?.exists) {
		throw new Error("The photo is no longer there. Try sharing it again.");
	}
	try {
		return await importPhoto(file.uri);
	} finally {
		try {
			file.delete();
		} catch (error) {
			console.warn("Couldn't delete the shared photo", error);
		}
	}
}

// On iOS, the app group's folder: the app has only the one, which it shares
// with its extension.
function sharedFolder(): Directory | null {
	if (Platform.OS === "android") return new Directory(Paths.cache, FOLDER);
	if (Platform.OS !== "ios") return null;
	const [container] = Object.values(Paths.appleSharedContainers);
	return container ? new Directory(container, FOLDER) : null;
}
