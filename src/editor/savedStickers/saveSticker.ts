import { ImageFormat } from "react-native-skia";
import { writeTemporaryPng } from "@/platform/temporaryFile";
import type { ImageLayer } from "../layers/image/image";
import { renderCutOut } from "../render/renderDocument";
import {
	newStickerId,
	SAVED_STICKER_MAX_SIDE,
	type SavedSticker,
	type StickerImage,
} from "./savedStickers";
import { addSticker } from "./stickerStorage";

type Listener = (sticker: SavedSticker) => void;

const listeners = new Set<Listener>();

/**
 * Keeps `image`, whose URI it takes over, as a new saved sticker, and tells
 * whoever lists the stickers (`onStickerSaved`). Throws if it fails.
 */
export async function saveSticker(image: StickerImage): Promise<SavedSticker> {
	const now = Date.now();
	const sticker: SavedSticker = {
		id: newStickerId(now),
		width: image.width,
		height: image.height,
		opaque: image.opaque,
		usedAt: now,
	};
	await addSticker(sticker, image.uri);
	for (const listener of listeners) listener(sticker);
	return sticker;
}

/** Calls `listener` with each sticker saved from now on, until unsubscribed. */
export function onStickerSaved(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * What a cut-out image layer keeps, trimmed to it, on a transparent
 * background, shrunk the way a saved sticker is.
 */
export async function cutOutSticker(layer: ImageLayer): Promise<StickerImage> {
	const image = await renderCutOut(layer, SAVED_STICKER_MAX_SIDE);
	try {
		return {
			uri: writeTemporaryPng(image.encodeToBytes(ImageFormat.PNG)),
			width: image.width(),
			height: image.height(),
			opaque: false,
		};
	} finally {
		image.dispose();
	}
}
