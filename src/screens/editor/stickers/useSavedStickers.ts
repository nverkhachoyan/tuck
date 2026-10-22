import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import {
	newStickerId,
	type SavedSticker,
	type StickerImage,
	withStickerUsed,
} from "./savedStickers";
import {
	addSticker,
	listStickers,
	markStickerUsed,
	releaseStickerUrl,
	removeSticker,
	stickerImageCopy,
	stickerUrl,
} from "./stickerStorage";

/** A saved sticker with a URL its image shows by. */
export type ShownSticker = SavedSticker & { url: string };

/**
 * The saved stickers, most recently used first, loaded when mounted: null
 * until then, and empty with an `error` if they couldn't be read. Each of
 * the actions throws if it fails, leaving the list as it was.
 */
export function useSavedStickers() {
	const [stickers, setStickers] = useState<ShownSticker[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Every URL shown, freed when unmounted.
	const urls = useRef(new Set<string>());

	useEffect(() => {
		const shown = urls.current;
		let mounted = true;
		void (async () => {
			try {
				const loaded = await Promise.all(
					(await listStickers()).map(async (sticker) => ({
						...sticker,
						url: await stickerUrl(sticker),
					})),
				);
				if (!mounted) {
					for (const { url } of loaded) releaseStickerUrl(url);
					return;
				}
				for (const { url } of loaded) shown.add(url);
				setStickers(loaded);
			} catch (cause) {
				if (!mounted) return;
				setError(errorMessage(cause));
				setStickers([]);
			}
		})();
		return () => {
			mounted = false;
			for (const url of shown) releaseStickerUrl(url);
			shown.clear();
		};
	}, []);

	/** Keeps `image`, whose URI it takes over, as a new sticker, listed first. */
	const save = async (image: StickerImage): Promise<SavedSticker> => {
		const now = Date.now();
		const sticker: SavedSticker = {
			id: newStickerId(now),
			width: image.width,
			height: image.height,
			opaque: image.opaque,
			usedAt: now,
		};
		await addSticker(sticker, image.uri);
		const url = await stickerUrl(sticker);
		urls.current.add(url);
		setStickers((list) => [{ ...sticker, url }, ...(list ?? [])]);
		return sticker;
	};

	/**
	 * A copy of the sticker's image for a project to take, and moves the
	 * sticker first.
	 */
	const place = async (sticker: SavedSticker): Promise<StickerImage> => {
		const uri = await stickerImageCopy(sticker);
		const now = Date.now();
		await markStickerUsed(sticker.id, now);
		setStickers((list) => list && withStickerUsed(list, sticker.id, now));
		const { width, height, opaque } = sticker;
		return { uri, width, height, opaque };
	};

	const remove = async (sticker: ShownSticker) => {
		await removeSticker(sticker);
		urls.current.delete(sticker.url);
		releaseStickerUrl(sticker.url);
		setStickers((list) => list?.filter(({ id }) => id !== sticker.id) ?? null);
	};

	return { stickers, error, save, place, remove };
}
