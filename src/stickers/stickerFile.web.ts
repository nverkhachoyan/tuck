import { Asset } from "expo-asset";
import type { Sticker } from "./stickers";

/**
 * The sticker's image URL, which a project fetches its own copy from, and
 * which works as a layer's image as is.
 */
export async function stickerFile(sticker: Sticker): Promise<string> {
	return Asset.fromModule(sticker.image).uri;
}
