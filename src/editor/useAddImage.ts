import { useRef, useState } from "react";
import { usePhotoDrop } from "@/platform/usePhotoDrop";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import type { EditorHost, PickedImage } from "./editorHost";

const FAILURES = {
	image: "Couldn't add photo",
	sticker: "Couldn't add sticker",
};

/**
 * Adds photos from the picker, or, on web while `enabled`, pasted or dropped
 * onto the page, each read by the `host` and shrunk to `maxShortSide`, and
 * whatever a tool loads (`addLayerImage`, as `ToolEnv` describes it). `onImage` puts
 * the image where it goes, as a photo or a sticker; an alert shows if that
 * or loading the image fails. `busy` is set while an image is on its way,
 * and adding another meanwhile does nothing.
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
	onImage: (image: PickedImage, kind: "image" | "sticker") => Promise<void>;
}) {
	// Picking and re-encoding a large photo takes a few seconds. Set at once,
	// so a second tap meanwhile can't open another picker.
	const adding = useRef(false);
	const [busy, setBusy] = useState(false);

	// Null from `load` adds nothing, as when the picker is canceled.
	const addLayerImage = async (
		load: () => Promise<PickedImage | null>,
		kind: "image" | "sticker",
	) => {
		if (adding.current) return;
		adding.current = true;
		setBusy(true);
		try {
			const image = await load();
			if (image) await onImage(image, kind);
		} catch (error) {
			showAlert(FAILURES[kind], errorMessage(error));
		} finally {
			adding.current = false;
			setBusy(false);
		}
	};

	const { dragging } = usePhotoDrop({
		enabled,
		onPhoto: (uri) =>
			addLayerImage(() => host.importPhoto(uri, { maxShortSide }), "image"),
	});

	const pick = () => {
		void addLayerImage(async () => {
			const result = await host.pickPhoto({ maxShortSide });
			return result.status === "canceled" ? null : result.photo;
		}, "image");
	};

	return { busy, dragging, pick, addLayerImage };
}
