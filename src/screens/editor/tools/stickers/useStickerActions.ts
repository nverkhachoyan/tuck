import { useCallback, useRef } from "react";
import { errorMessage } from "@/lib/errorMessage";
import type { PickedPhoto } from "@/photos/photoImport";
import { showAlert } from "@/ui/showAlert";
import type { Sticker } from "./bundledStickers";
import type { StickerImage } from "./savedStickers";
import { bundledStickerImage } from "./stickerFile";
import type { ShownSticker, useSavedStickers } from "./useSavedStickers";

export type UseStickerActionsInput = {
	savedStickers: ReturnType<typeof useSavedStickers>;
	addSticker: (load: () => Promise<StickerImage | null>) => void;
	pickSticker: (keep: (image: PickedPhoto) => Promise<StickerImage>) => void;
	closeStickers: () => void;
	waitForDismiss: boolean;
};

export type StickerActions = {
	savedStickers: ShownSticker[] | null;
	savedError: string | null;
	onAddSticker: (sticker: Sticker) => void;
	onAddSaved: (sticker: ShownSticker) => void;
	onSaveNew: () => void;
	onDeleteSaved: (sticker: ShownSticker) => void;
	onDismiss: () => void;
};

/**
 * Actions for the sticker sheet and popover: adding bundled or saved stickers,
 * picking a new photo to make into a saved sticker, and deleting saved ones.
 *
 * Owns the dismiss coordination for iPad, where the photo picker must wait
 * for the popover to finish closing before opening.
 */
export function useStickerActions({
	savedStickers,
	addSticker,
	pickSticker,
	closeStickers,
	waitForDismiss,
}: UseStickerActionsInput): StickerActions {
	const afterStickers = useRef<(() => void) | null>(null);

	const onDismiss = useCallback(() => {
		const next = afterStickers.current;
		afterStickers.current = null;
		next?.();
	}, []);

	const addStickerFrom = useCallback(
		(load: () => Promise<StickerImage | null>) => {
			closeStickers();
			addSticker(load);
		},
		[addSticker, closeStickers],
	);

	const onAddSticker = useCallback(
		(sticker: Sticker) => addStickerFrom(() => bundledStickerImage(sticker)),
		[addStickerFrom],
	);

	const onAddSaved = useCallback(
		(sticker: ShownSticker) =>
			addStickerFrom(() => savedStickers.place(sticker)),
		[addStickerFrom, savedStickers],
	);

	const onSaveNew = useCallback(() => {
		const pick = () =>
			pickSticker(async (image) =>
				savedStickers.place(await savedStickers.save(image)),
			);
		closeStickers();
		if (waitForDismiss) afterStickers.current = pick;
		else pick();
	}, [closeStickers, pickSticker, savedStickers, waitForDismiss]);

	const onDeleteSaved = useCallback(
		(sticker: ShownSticker) => {
			savedStickers.remove(sticker).catch((error: unknown) => {
				showAlert("Couldn't delete sticker", errorMessage(error));
			});
		},
		[savedStickers],
	);

	return {
		savedStickers: savedStickers.stickers,
		savedError: savedStickers.error,
		onAddSticker,
		onAddSaved,
		onSaveNew,
		onDeleteSaved,
		onDismiss,
	};
}
