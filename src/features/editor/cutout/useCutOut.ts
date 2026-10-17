import { useRef, useState } from "react";
import {
	findSubjectMask,
	type ImagePoint,
	isCutOutAvailable,
	isDetectionModelDownloading,
} from "@/detection/imageDetection";
import { errorMessage } from "@/lib/errorMessage";
import type { ImageLayer } from "@/model/document";
import { showAlert } from "@/ui/showAlert";

/**
 * Finds the subjects to cut out of an image: every one, or with a point,
 * only the one there. `find` hands the mask to `onMask`, once `keep` has put
 * its file where the document can use it; `onMask` decides whether the image
 * still wants it. `finding` says which is being found, while one is: a
 * second find meanwhile does nothing. Every subject found once is used again
 * this session, whose project keeps its file until it closes. `news` says
 * what the last find did, for a screen reader. `canFind` is false while this
 * device can't find subjects, when only the brushes cut.
 */
export function useCutOut({
	projectId,
	keep,
	onMask,
}: {
	projectId: string | null;
	keep: (uri: string) => Promise<string>;
	onMask: (layerId: string, mask: string) => void;
}) {
	const [finding, setFinding] = useState<"all" | "one" | null>(null);
	const [news, setNews] = useState<string | null>(null);
	const busy = useRef(false);
	// The mask of every subject found for each image file in this project.
	const found = useRef({ projectId, masks: new Map<string, string>() });
	if (found.current.projectId !== projectId) {
		found.current = { projectId, masks: new Map() };
	}

	const find = async (layer: ImageLayer, at?: ImagePoint) => {
		const { masks } = found.current;
		const known = at ? undefined : masks.get(layer.uri);
		if (known !== undefined) {
			onMask(layer.id, known);
			setNews("Background removed");
			return;
		}
		if (busy.current) return;
		busy.current = true;
		setFinding(at ? "one" : "all");
		setNews(at ? "Finding the subject" : "Removing the background");
		try {
			const mask = await findSubjectMask(layer.uri, at);
			if (!mask) {
				setNews(null);
				showAlert(
					"Nothing to cut out",
					at
						? "There's no clear subject where you tapped. Try the middle of it, or paint the cut with Keep and Erase."
						: "There's no clear subject in front of the background.",
				);
				return;
			}
			const url = await keep(mask.uri);
			if (!at) masks.set(layer.uri, url);
			onMask(layer.id, url);
			setNews(at ? "Subject picked" : "Background removed");
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
			setFinding(null);
		}
	};

	return { canFind: isCutOutAvailable(), finding, news, find };
}
