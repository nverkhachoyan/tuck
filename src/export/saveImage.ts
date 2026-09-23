import type { SkImage } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { type ExportFormat, encodeImage, exportFormats } from "./exportFormat";

// `saveImage.web.ts` implements the same API for browsers.

export type SaveImageResult =
	| { status: "saved" }
	| { status: "permission-denied" };

/** The save button's label before, during, and after `saveImage`. */
export const saveLabels = {
	idle: "Save to Photos",
	busy: "Saving…",
	done: "Saved to Photos",
};

/**
 * Adds a rendered image to the user's photo library. Asks only for add-only
 * access: saving never needs to read the library. `Asset.create` checks the
 * permission but won't prompt for it, so the request has to come first.
 */
export async function saveImage(
	image: SkImage,
	format: ExportFormat,
): Promise<SaveImageResult> {
	const permission = await MediaLibrary.requestPermissionsAsync(true, [
		"photo",
	]);
	if (!permission.granted) {
		return { status: "permission-denied" };
	}

	await MediaLibrary.Asset.create(writeImage(image, format).uri);
	return { status: "saved" };
}

/** iOS and Android always have a share sheet. */
export function canShareImages(): boolean {
	return true;
}

/**
 * Encodes a rendered image and opens the system share sheet. Returns false
 * when sharing isn't available on this platform.
 */
export async function shareImage(
	image: SkImage,
	format: ExportFormat,
): Promise<boolean> {
	if (!(await Sharing.isAvailableAsync())) return false;

	const { mimeType, uti } = exportFormats[format];
	await Sharing.shareAsync(writeImage(image, format).uri, {
		mimeType,
		UTI: uti,
	});
	return true;
}

// Earlier exports are done with by the next one: saved into Photos, or read
// by the app they were shared to.
function writeImage(image: SkImage, format: ExportFormat): File {
	for (const entry of Paths.cache.list()) {
		if (entry instanceof File && isExportFile(entry.name)) entry.delete();
	}
	const { extension } = exportFormats[format];
	const file = new File(Paths.cache, `export-${Date.now()}.${extension}`);
	file.create({ overwrite: true });
	file.write(encodeImage(image, format));
	return file;
}

function isExportFile(name: string) {
	return (
		name.startsWith("export-") &&
		Object.values(exportFormats).some(({ extension }) =>
			name.endsWith(`.${extension}`),
		)
	);
}
