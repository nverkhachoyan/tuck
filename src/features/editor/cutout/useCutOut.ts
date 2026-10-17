import { useRef, useState } from "react";
import {
	findSubjectMask,
	isCutOutAvailable,
	isDetectionModelDownloading,
} from "@/detection/imageDetection";
import { errorMessage } from "@/lib/errorMessage";
import type { ImageLayer } from "@/model/document";
import { useStore } from "@/store";
import { showAlert } from "@/ui/showAlert";

/**
 * Cuts an image's subject out of its background, or with one cut out
 * already, brings the background back, each as one undo step. `cutting` is
 * the id of the image being cut out, while its subject is being found; a
 * second cut meanwhile does nothing. A mask found once is used again this
 * session, whose project keeps its file until it closes. `keep` puts a new
 * mask's file where the document can use it, and returns its URL there.
 * `news` says what the last toggle did, for a screen reader. Null while this
 * device can't find subjects.
 */
export function useCutOut({
	projectId,
	keep,
}: {
	projectId: string | null;
	keep: (uri: string) => Promise<string>;
}) {
	const setMask = useStore((state) => state.setMask);
	const [cutting, setCutting] = useState<string | null>(null);
	const [news, setNews] = useState<string | null>(null);
	const busy = useRef(false);
	// The mask found for each image file in this project.
	const found = useRef({ projectId, masks: new Map<string, string>() });
	if (found.current.projectId !== projectId) {
		found.current = { projectId, masks: new Map() };
	}

	const toggle = async (layer: ImageLayer) => {
		const { masks } = found.current;
		if (layer.mask !== undefined) {
			masks.set(layer.uri, layer.mask);
			setMask(layer.id, null);
			setNews("Background restored");
			return;
		}
		const known = masks.get(layer.uri);
		if (known !== undefined) {
			setMask(layer.id, known);
			setNews("Background removed");
			return;
		}
		if (busy.current) return;
		busy.current = true;
		setCutting(layer.id);
		setNews("Removing the background");
		try {
			const mask = await findSubjectMask(layer.uri);
			if (!mask) {
				setNews(null);
				showAlert(
					"Nothing to cut out",
					"There's no clear subject in front of the background.",
				);
				return;
			}
			const url = await keep(mask.uri);
			masks.set(layer.uri, url);
			setMask(layer.id, url);
			setNews("Background removed");
		} catch (error) {
			setNews(null);
			showAlert(
				"Couldn't remove the background",
				isDetectionModelDownloading(error)
					? "Cut out is still downloading. Try again in a moment."
					: errorMessage(error),
			);
		} finally {
			busy.current = false;
			setCutting(null);
		}
	};

	return isCutOutAvailable() ? { cutting, news, toggle } : null;
}
