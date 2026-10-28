import { useRef, useState } from "react";
import { usePhotoDrop } from "@/platform/usePhotoDrop";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import type { EditorHost, PickedImage } from "./editorHost";
import {
	SAVED_STICKER_MAX_SIDE,
	type StickerImage,
} from "./stickers/savedStickers";

export type AddedImage = PickedImage & { sticker: boolean };

/**
 * Adds photos from the picker, or, on web while `enabled`, pasted or dropped
 * onto the page, each read by the `host` and shrunk to `maxShortSide`, and
 * stickers, from whatever `addSticker` is given to load one. `onImage` puts
 * the image where it goes; an alert shows if that or loading the image
 * fails. `busy` is set while an image is on its way, and adding another
 * meanwhile does nothing.
 */
export function useAddImage({
	host,
	enabled,
	maxShortSide,
	onImage,
}: {
	host: Pick<EditorHost, "pickPhoto" | "importPhoto">;
	enabled: boolean;
	maxShortSide: number;
	onImage: (image: AddedImage) => Promise<void>;
}) {
	// Picking and re-encoding a large photo takes a few seconds. Set at once,
	// so a second tap meanwhile can't open another picker.
	const adding = useRef(false);
	const [busy, setBusy] = useState(false);

	const addImage = async (
		load: () => Promise<AddedImage | null>,
		failure: string,
	) => {
		if (adding.current) return;
		adding.current = true;
		setBusy(true);
		try {
			const image = await load();
			if (image) await onImage(image);
		} catch (error) {
			showAlert(failure, errorMessage(error));
		} finally {
			adding.current = false;
			setBusy(false);
		}
	};
	const addPhoto = (load: () => Promise<PickedImage | null>) =>
		addImage(async () => {
			const photo = await load();
			return photo && { ...photo, sticker: false };
		}, "Couldn't add photo");

	const { dragging } = usePhotoDrop({
		enabled,
		onPhoto: (uri) => addPhoto(() => host.importPhoto(uri, { maxShortSide })),
	});

	const pick = () => {
		void addPhoto(async () => {
			const result = await host.pickPhoto({ maxShortSide });
			return result.status === "canceled" ? null : result.photo;
		});
	};

	// Null from `load` adds nothing, as when the picker is canceled.
	const addSticker = (load: () => Promise<StickerImage | null>) => {
		void addImage(async () => {
			const image = await load();
			return image && { ...image, sticker: true };
		}, "Couldn't add sticker");
	};

	/**
	 * Picks an image to make a sticker of, shrunk as saved stickers are, and
	 * adds the image `keep` returns once it has kept it.
	 */
	const pickSticker = (keep: (image: PickedImage) => Promise<StickerImage>) =>
		addSticker(async () => {
			const result = await host.pickPhoto({
				maxLongSide: SAVED_STICKER_MAX_SIDE,
			});
			return result.status === "canceled" ? null : keep(result.photo);
		});

	return { busy, dragging, pick, addSticker, pickSticker };
}
