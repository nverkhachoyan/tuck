import { useRef, useState } from "react";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/import/photoImport";
import { usePhotoDrop } from "@/import/usePhotoDrop";
import { errorMessage } from "@/lib/errorMessage";
import { stickerFile } from "@/stickers/stickerFile";
import { STICKER_SIZE, type Sticker } from "@/stickers/stickers";
import { showAlert } from "@/ui/showAlert";

export type AddedImage = PickedPhoto & { sticker: boolean };

/**
 * Adds photos from the picker, or, on web while `enabled`, pasted or dropped
 * onto the page, each shrunk to `maxShortSide`, and stickers. `onImage` puts
 * the image where it goes; an alert shows if that or reading the image
 * fails. `busy` is set while an image is on its way, and adding another
 * meanwhile does nothing.
 */
export function useAddImage({
	enabled,
	maxShortSide,
	onImage,
}: {
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
	const addPhoto = (load: () => Promise<PickedPhoto | null>) =>
		addImage(async () => {
			const photo = await load();
			return photo && { ...photo, sticker: false };
		}, "Couldn't add photo");

	const { dragging } = usePhotoDrop({
		enabled,
		onPhoto: (uri) => addPhoto(() => importPhoto(uri, { maxShortSide })),
	});

	const pick = () => {
		void addPhoto(async () => {
			const result = await pickPhoto({ maxShortSide });
			return result.status === "canceled" ? null : result.photo;
		});
	};

	const addSticker = (sticker: Sticker) => {
		void addImage(
			async () => ({
				uri: await stickerFile(sticker),
				width: STICKER_SIZE,
				height: STICKER_SIZE,
				opaque: false,
				sticker: true,
			}),
			"Couldn't add sticker",
		);
	};

	return { busy, dragging, pick, addSticker };
}
