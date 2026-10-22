import { ImageFormat, type SkImage } from "@shopify/react-native-skia";
import { useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import { writeTemporaryPng } from "@/lib/temporaryFile";
import { type ImageLayer, isCutOut } from "@/model/document";
import { importPhoto } from "@/photos/photoImport";
import { selectSelectedLayer, useStore } from "@/store";
import { showAlert } from "@/ui/showAlert";
import { SAVED_STICKER_MAX_SIDE, type StickerImage } from "./savedStickers";
import type { useSavedStickers } from "./useSavedStickers";

/**
 * Keeping the selected photo as a sticker, shrunk the way a saved sticker
 * is, so a large photo doesn't make one. A cut-out keeps only what its cut
 * shows, trimmed to it, on a transparent background. `status` is the
 * selection's: being kept, or kept already this session. `save` is left
 * out when the selection can't be kept: a sticker already is one.
 * `renderCutOut` draws a cut-out's kept part, its longer side `maxSide`
 * pixels at most.
 */
export function useStickerSave(
	keep: ReturnType<typeof useSavedStickers>["save"],
	renderCutOut: (layer: ImageLayer, maxSide: number) => Promise<SkImage>,
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
					? await cutOutSticker(image, renderCutOut)
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

async function cutOutSticker(
	layer: ImageLayer,
	render: (layer: ImageLayer, maxSide: number) => Promise<SkImage>,
): Promise<StickerImage> {
	const image = await render(layer, SAVED_STICKER_MAX_SIDE);
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
