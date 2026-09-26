import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import type { Sticker } from "./stickers";

// `stickerFile.web.ts` does the same in browsers.

/**
 * A copy of a sticker's image to hand a project, which moves it into its
 * own folder: the bundled file itself can't be moved, and in a release
 * build lives in the app's read-only bundle.
 */
export async function stickerFile(sticker: Sticker): Promise<string> {
	const asset = await Asset.fromModule(sticker.image).downloadAsync();
	const copy = new File(
		Paths.cache,
		`sticker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`,
	);
	await new File(asset.localUri ?? asset.uri).copy(copy);
	return copy.uri;
}
