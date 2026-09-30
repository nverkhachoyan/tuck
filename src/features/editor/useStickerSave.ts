import { useState } from "react";
import { importPhoto } from "@/import/photoImport";
import { errorMessage } from "@/lib/errorMessage";
import { SAVED_STICKER_MAX_SIDE } from "@/stickers/savedStickers";
import type { useSavedStickers } from "@/stickers/useSavedStickers";
import { useStore } from "@/store";
import { selectSelectedLayer } from "@/store/editorSlice";
import { showAlert } from "@/ui/showAlert";

/**
 * Keeping the selected photo as a sticker, shrunk the way a saved sticker
 * is, so a large photo doesn't make one. `status` is the selection's: being
 * kept, or kept already this session. `save` is left out when the selection
 * can't be kept: a sticker is kept from an image's file, which a cut-out's
 * mask isn't part of.
 */
export function useStickerSave(
	keep: ReturnType<typeof useSavedStickers>["save"],
) {
	const selectedLayer = useStore(selectSelectedLayer);
	const [saving, setSaving] = useState<{
		layerId: string;
		status: "saving" | "saved";
	} | null>(null);
	const image =
		selectedLayer?.type === "image" &&
		!selectedLayer.sticker &&
		selectedLayer.mask === undefined
			? selectedLayer
			: undefined;
	const save = async () => {
		if (!image || saving?.status === "saving") return;
		const layerId = image.id;
		setSaving({ layerId, status: "saving" });
		try {
			await keep(
				await importPhoto(image.uri, { maxLongSide: SAVED_STICKER_MAX_SIDE }),
			);
			setSaving({ layerId, status: "saved" });
		} catch (error) {
			setSaving(null);
			showAlert("Couldn't save sticker", errorMessage(error));
		}
	};

	return {
		status:
			saving && saving.layerId === selectedLayer?.id
				? saving.status
				: undefined,
		save: image ? save : undefined,
	};
}
