import type { ToolEnv } from "../../defineTool";
import type { Layer } from "../../layers/layer";
import type { LayerAction } from "../../shell/LayerActionsPanel";
import { useSavedStickers } from "./useSavedStickers";
import { useStickerActions } from "./useStickerActions";
import { useStickerSave } from "./useStickerSave";

export type StickersController = ReturnType<typeof useStickersTool>;

/**
 * Stickers' state and actions: the saved stickers, adding one, and keeping
 * the selected photo as one (`layerAction`, a button among its actions).
 */
export function useStickersTool({
	close,
	addLayerImage,
	pickPhoto,
	importPhoto,
}: ToolEnv) {
	const savedStickers = useSavedStickers();
	const stickerSave = useStickerSave(savedStickers.save, importPhoto);
	const actions = useStickerActions({
		savedStickers,
		addLayerImage,
		pickPhoto,
		close,
	});

	// Saved, once kept this session, or Sticker.
	const layerAction = (layer: Layer): LayerAction | null => {
		const { save, status } = stickerSave;
		if (!save || layer.type !== "image") return null;
		return {
			label: status === "saved" ? "Saved" : "Sticker",
			icon:
				status === "saved" ? "sticker-check-outline" : "sticker-plus-outline",
			busy: status === "saving",
			disabled: status === "saved",
			onPress: save,
		};
	};

	return { ...actions, layerAction };
}
