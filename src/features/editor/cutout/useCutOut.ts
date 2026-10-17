import { useRef, useState } from "react";
import {
	findSubjectMask,
	type ImagePoint,
	isCutOutAvailable,
	isDetectionModelDownloading,
} from "@/detection/imageDetection";
import { decodedImages, decodeImage } from "@/layers/decodedImages";
import { errorMessage } from "@/lib/errorMessage";
import { deleteTemporaryFile, writeTemporaryPng } from "@/lib/temporaryFile";
import type { ImageLayer } from "@/model/document";
import { showAlert } from "@/ui/showAlert";
import { combineMasks, cutShowsAt } from "./cutMask";

/**
 * Finds the subjects to cut out of an image: every one, or with a point,
 * the one there. A point on an image without a mask cuts out only that
 * subject; on one with a mask, it adds the subject to the cut, or takes it
 * out when the cut shows the image there. `latest` is the image as it is
 * by then, which a pick changes. `find` hands the mask to `onMask`, once
 * `keep` has put its file where the document can use it, saying whether it
 * grew from the image's mask, which keeps the strokes that refined it;
 * `onMask` decides whether the image still wants it. `finding` says which is being found, while one is: a
 * second find meanwhile does nothing. Every subject found once is used again
 * this session, whose project keeps its file until it closes. `news` says
 * what the last find did, for a screen reader. `canFind` is false while this
 * device can't find subjects, when only the brushes cut.
 */
export function useCutOut({
	projectId,
	latest,
	keep,
	onMask,
}: {
	projectId: string | null;
	latest: (layerId: string) => ImageLayer | undefined;
	keep: (uri: string) => Promise<string>;
	onMask: (layerId: string, mask: string, picked: boolean) => void;
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
			onMask(layer.id, known, false);
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
			if (!at) {
				const url = await keep(mask.uri);
				masks.set(layer.uri, url);
				onMask(layer.id, url, false);
				setNews("Background removed");
				return;
			}
			const current = latest(layer.id);
			if (!current) return;
			const picked =
				current.mask === undefined
					? { uri: mask.uri, news: "Subject picked" }
					: await pickInto(current, current.mask, mask.uri, at);
			const url = await keep(picked.uri);
			// Cut another way meanwhile, the pick no longer fits.
			if (latest(layer.id)?.mask !== current.mask) return;
			onMask(layer.id, url, true);
			setNews(picked.news);
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

/**
 * `subject` added to `layer`'s cut, or taken out of it where the cut shows
 * the image `at` the point tapped, as a new mask file.
 */
async function pickInto(
	layer: ImageLayer,
	mask: string,
	subject: string,
	at: ImagePoint,
): Promise<{ uri: string; news: string }> {
	const held = decodedImages.acquire(mask);
	try {
		const current = await held.decoded;
		const add = !(await cutShowsAt(layer, current, at));
		const picked = await decodeImage(subject);
		try {
			const bytes = await combineMasks(current, picked, add ? "add" : "remove");
			return {
				uri: writeTemporaryPng(bytes),
				news: add ? "Subject added" : "Subject removed",
			};
		} finally {
			picked.dispose();
		}
	} finally {
		held.release();
		deleteTemporaryFile(subject);
	}
}
