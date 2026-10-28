import { defineTool } from "../../defineTool";
import { StickerSheet } from "./StickerSheet";
import { stickersSpec } from "./stickersSpec";
import { type StickersController, useStickersTool } from "./useStickersTool";

/**
 * Adds bundled stickers and the ones people save, from a sheet that closes
 * as one is added, and keeps a selected photo as a sticker.
 */
export const stickersTool = defineTool<StickersController>({
	spec: stickersSpec,
	useController: useStickersTool,
	views: { Sheet: StickerSheet },
	sheetTitle: "Stickers",
	sheetDismissed: (stickers) => stickers.onDismiss(),
	layerAction: (stickers, layer) => stickers.layerAction(layer),
});
