import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import type { StickerImage } from "../../savedStickers/savedStickers";
import { STICKER_SIZE, type Sticker } from "./bundledStickers";

// `stickerFile.web.ts` does the same in browsers.

/**
 * A copy of a bundled sticker's image to hand a project, which moves it
 * into its own folder: the bundled file itself can't be moved, and in a
 * release build lives in the app's read-only bundle.
 */
export async function bundledStickerImage(
	sticker: Sticker,
): Promise<StickerImage> {
	const asset = await Asset.fromModule(sticker.image).downloadAsync();
	const copy = new File(
		Paths.cache,
		`sticker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`,
	);
	await new File(asset.localUri ?? asset.uri).copy(copy);
	return {
		uri: copy.uri,
		width: STICKER_SIZE,
		height: STICKER_SIZE,
		opaque: false,
	};
}
