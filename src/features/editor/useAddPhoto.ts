import { useRef, useState } from "react";
import { importPhoto, type PickedPhoto, pickPhoto } from "@/import/pickPhoto";
import { usePhotoDrop } from "@/import/usePhotoDrop";
import { errorMessage } from "@/lib/errorMessage";
import { showAlert } from "@/lib/showAlert";

/**
 * Adds photos from the picker, or, on web while `enabled`, pasted or dropped
 * onto the page, each shrunk to `maxShortSide`. `onPhoto` puts the photo
 * where it goes; an alert shows if that or reading the photo fails. `busy`
 * is set while a photo is on its way, and a pick meanwhile does nothing.
 */
export function useAddPhoto({
	enabled,
	maxShortSide,
	onPhoto,
}: {
	enabled: boolean;
	maxShortSide: number;
	onPhoto: (photo: PickedPhoto) => Promise<void>;
}) {
	// Picking and re-encoding a large photo takes a few seconds. Set at once,
	// so a second tap meanwhile can't open another picker.
	const adding = useRef(false);
	const [busy, setBusy] = useState(false);

	const addPhoto = async (load: () => Promise<PickedPhoto | null>) => {
		if (adding.current) return;
		adding.current = true;
		setBusy(true);
		try {
			const photo = await load();
			if (photo) await onPhoto(photo);
		} catch (error) {
			showAlert("Couldn't add photo", errorMessage(error));
		} finally {
			adding.current = false;
			setBusy(false);
		}
	};

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

	return { busy, dragging, pick };
}
