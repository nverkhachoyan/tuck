import { useCallback, useRef } from "react";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import type { ToolEnv } from "../../defineTool";
import type { Sticker } from "./bundledStickers";
import { SAVED_STICKER_MAX_SIDE, type StickerImage } from "./savedStickers";
import { bundledStickerImage } from "./stickerFile";
import type { ShownSticker, useSavedStickers } from "./useSavedStickers";

export type UseStickerActionsInput = {
	savedStickers: ReturnType<typeof useSavedStickers>;
	addLayerImage: ToolEnv["addLayerImage"];
	pickPhoto: ToolEnv["pickPhoto"];
	close: () => void;
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
 * Adding one closes Stickers first, so its layer is an undo step of its own.
 *
 * The photo picker waits for the sheet to finish closing (`onDismiss`): on
 * iPad, one opened sooner goes down with the popover.
 */
export function useStickerActions({
	savedStickers,
	addLayerImage,
	pickPhoto,
	close,
}: UseStickerActionsInput): StickerActions {
	const afterStickers = useRef<(() => void) | null>(null);

	const onDismiss = useCallback(() => {
		const next = afterStickers.current;
		afterStickers.current = null;
		next?.();
	}, []);

	const addStickerFrom = (load: () => Promise<StickerImage>) => {
		close();
		addLayerImage(load, "sticker");
	};

	const onAddSticker = (sticker: Sticker) =>
		addStickerFrom(() => bundledStickerImage(sticker));

	const onAddSaved = (sticker: ShownSticker) =>
		addStickerFrom(() => savedStickers.place(sticker));

	// The picked image is shrunk as saved stickers are, kept, and added.
	const onSaveNew = () => {
		afterStickers.current = () =>
			addLayerImage(async () => {
				const result = await pickPhoto({ maxLongSide: SAVED_STICKER_MAX_SIDE });
				if (result.status === "canceled") return null;
				return savedStickers.place(await savedStickers.save(result.photo));
			}, "sticker");
		close();
	};

	const onDeleteSaved = (sticker: ShownSticker) => {
		savedStickers.remove(sticker).catch((error: unknown) => {
			showAlert("Couldn't delete sticker", errorMessage(error));
		});
	};

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
