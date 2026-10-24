import { ImageFormat } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import type { Rect } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { writeTemporaryPng } from "@/platform/temporaryFile";
import { renderCutShape } from "@/render/renderDocument";
import { showAlert } from "@/ui/showAlert";

// A selection's mask is stretched over what it covers, so it needn't have
// every pixel of a large photo: soft edges hide the difference.
const MASK_MAX_SIDE = 2048;

/**
 * Redacting what an image's cut keeps: its shape, trimmed to it, drawn by
 * `renderCutShape` (with the part of the image it covers), becomes a mask
 * file that `keep` puts where the document can use it, and `onRedact`
 * gets that file and the part of the image it covers (see
 * `createMaskedRedaction`). `busy` while that's being made: a second press
 * meanwhile does nothing.
 */
export function useCutRedaction({
	keep,
	onRedact,
}: {
	keep: (uri: string) => Promise<string>;
	onRedact: (layerId: string, mask: string, rect: Rect) => void;
}) {
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const redact = async (layer: ImageLayer) => {
		if (running.current) return;
		running.current = true;
		setBusy(true);
		try {
			const { image, rect } = await renderCutShape(layer, MASK_MAX_SIDE);
			let bytes: Uint8Array;
			try {
				bytes = image.encodeToBytes(ImageFormat.PNG);
			} finally {
				image.dispose();
			}
			onRedact(layer.id, await keep(writeTemporaryPng(bytes)), rect);
		} catch (error) {
			showAlert("Couldn't redact the selection", errorMessage(error));
		} finally {
			running.current = false;
			setBusy(false);
		}
	};
	return { busy, redact };
}
