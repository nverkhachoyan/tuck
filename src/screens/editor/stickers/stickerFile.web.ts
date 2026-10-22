import { Asset } from "expo-asset";
import type { StickerImage } from "./savedStickers";
import { STICKER_SIZE, type Sticker } from "./stickers";

/**
 * A bundled sticker's image by its URL, which a project fetches its own
 * copy from, and which works as a layer's image as is.
 */
export async function bundledStickerImage(
	sticker: Sticker,
): Promise<StickerImage> {
	return {
		uri: Asset.fromModule(sticker.image).uri,
		width: STICKER_SIZE,
		height: STICKER_SIZE,
		opaque: false,
	};
}
