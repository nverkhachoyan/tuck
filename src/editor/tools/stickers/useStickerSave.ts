import { useState } from "react";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import type { EditorHost } from "../../editorHost";
import { isCutOut } from "../../layers/image/mask";
import { SAVED_STICKER_MAX_SIDE } from "../../savedStickers/savedStickers";
import { cutOutSticker } from "../../savedStickers/saveSticker";
import { useStore } from "../../store";
import { selectSelectedLayer } from "../../store/editorSlice";
import type { useSavedStickers } from "./useSavedStickers";

/**
 * Keeping the selected photo as a sticker, shrunk the way a saved sticker
 * is, so a large photo doesn't make one. A cut-out keeps only what its cut
 * shows, trimmed to it, on a transparent background. `status` is the
 * selection's: being kept, or kept already this session. `save` is left
 * out when the selection can't be kept: a sticker already is one. A photo
 * is read through the host's `importPhoto`.
 */
export function useStickerSave(
	keep: ReturnType<typeof useSavedStickers>["save"],
	importPhoto: EditorHost["importPhoto"],
) {
	const selectedLayer = useStore(selectSelectedLayer);
	const [saving, setSaving] = useState<{
		layerId: string;
		status: "saving" | "saved";
	} | null>(null);
	const image =
		selectedLayer?.type === "image" && !selectedLayer.sticker
			? selectedLayer
			: undefined;
	const save = async () => {
		if (!image || saving?.status === "saving") return;
		const layerId = image.id;
		setSaving({ layerId, status: "saving" });
		try {
			await keep(
				isCutOut(image)
					? await cutOutSticker(image)
					: await importPhoto(image.uri, {
							maxLongSide: SAVED_STICKER_MAX_SIDE,
						}),
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
