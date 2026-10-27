import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import { isCutOut } from "@/model/cutout";
import type { ImageLayer } from "@/model/layers/image";
import {
	deleteTemporaryFile,
	writeTemporaryPng,
} from "@/platform/temporaryFile";
import { decodedImages, decodeImage } from "@/render/decodedImages";
import { showAlert } from "@/ui/showAlert";
import {
	findObjectMasks,
	findSubjectMask,
	type ImagePoint,
	isCutOutAvailable,
	isSubjectModelDownloading,
	prepareObjectSelection,
	releaseObjectSelection,
} from "../../detection/subjectDetection";
import { combineMasks, cutShowsAt, invertedMask } from "./cutMask";
import { type LastPick, nextMask, picksAgain } from "./pickGrowth";

/**
 * The last pick, kept to grow it: the masks found where it was tapped, the
 * one it took, the image's mask before it (`base`), and whether it added
 * to that or took out of it (null when there was none, and the pick is all
 * that's kept).
 */
type Pick = LastPick & {
	masks: SkImage[];
	index: number;
	base: string | undefined;
	add: boolean | null;
};

/**
 * Finds the subjects to cut out of `image`, and turns a cut inside out.
 * - Finds every subject, or with a point the one there, or once Segment
 *   Anything is ready, any object there.
 * - A point on an image without a mask cuts out only what's there. On one
 *   with a mask, it adds that to the cut, or takes it out when the cut
 *   shows the image there.
 * - Another tap on the same spot grows what it took, from a part to the
 *   whole and around again, where there's more than one to choose from.
 * - While `picking`, the image is read ahead for that.
 * - `latest` is the image as it is by then, which a pick changes.
 * - `find` hands the mask to `onMask`, once `keep` has put its file where
 *   the document can use it, saying whether it was picked, which keeps the
 *   strokes that refined the cut.
 * - `onMask` decides whether the image still wants it.
 * - `finding` says which is being found, while one is. A second find
 *   meanwhile does nothing.
 * - Every subject found once is used again this session, whose project
 *   keeps its file until it closes.
 * - `invert` turns the cut inside out, keeping what it removed and removing
 *   what it kept, and hands `onInvert` the inverted mask's file,
 *   `inverting` meanwhile. It waits for a find, and a find for it.
 * - `news` says what the last find or inversion did, for a screen reader.
 * - `canFind` is false while this device can't find subjects, when only the
 *   brushes cut.
 */
export function useCutOut({
	projectId,
	image,
	picking,
	latest,
	keep,
	onMask,
	onInvert,
}: {
	projectId: string | null;
	image: ImageLayer | undefined;
	picking: boolean;
	latest: (layerId: string) => ImageLayer | undefined;
	keep: (uri: string) => Promise<string>;
	onMask: (layerId: string, mask: string, picked: boolean) => void;
	onInvert: (layerId: string, mask: string) => void;
}) {
	const [finding, setFinding] = useState<"all" | "one" | null>(null);
	const [inverting, setInverting] = useState(false);
	const [news, setNews] = useState<string | null>(null);
	const busy = useRef(false);
	// The mask of every subject found for each image file in this project.
	const found = useRef({ projectId, masks: new Map<string, string>() });
	if (found.current.projectId !== projectId) {
		found.current = { projectId, masks: new Map() };
	}
	const lastPick = useRef<Pick | null>(null);
	const forgetPick = () => {
		for (const mask of lastPick.current?.masks ?? []) mask.dispose();
		lastPick.current = null;
	};

	const uri = image?.uri;
	useEffect(() => {
		if (uri !== undefined && picking) prepareObjectSelection(uri);
	}, [uri, picking]);
	// Put down, or moved to another image, Cut out lets go of what it read.
	useEffect(() => {
		if (uri === undefined) return;
		return () => {
			for (const mask of lastPick.current?.masks ?? []) mask.dispose();
			lastPick.current = null;
			releaseObjectSelection();
		};
	}, [uri]);

	const findAll = async (layer: ImageLayer) => {
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
		found.current.masks.set(layer.uri, url);
		onMask(layer.id, url, false);
		setNews("Background removed");
	};

	const pick = async (layer: ImageLayer, at: ImagePoint) => {
		const current = latest(layer.id);
		if (!current) return;
		const last = lastPick.current;
		let next: Pick;
		if (last && last.masks.length > 1 && picksAgain(last, current, at)) {
			next = { ...last, index: nextMask(last.index, last.masks.length) };
		} else {
			forgetPick();
			const found = await newPick(current, at);
			if (!found) {
				setNews(null);
				showAlert(
					"Nothing to cut out",
					"There's no clear subject where you tapped. Try the middle of it, or paint the cut with Keep and Erase.",
				);
				return;
			}
			next = found;
		}
		const grown = next.masks === last?.masks;
		let kept: string;
		try {
			kept = await keep(writeTemporaryPng(await pickedMask(next)));
			// Cut another way meanwhile, the pick no longer fits.
			if (latest(layer.id)?.mask !== current.mask) {
				throw new PickOvertaken();
			}
		} catch (error) {
			if (!grown) for (const mask of next.masks) mask.dispose();
			if (error instanceof PickOvertaken) return;
			throw error;
		}
		onMask(layer.id, kept, true);
		lastPick.current = { ...next, mask: kept };
		setNews(pickNews(next, grown));
	};

	const find = async (layer: ImageLayer, at?: ImagePoint) => {
		const known = at ? undefined : found.current.masks.get(layer.uri);
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
			await (at ? pick(layer, at) : findAll(layer));
		} catch (error) {
			setNews(null);
			showAlert(
				"Couldn't remove the background",
				isSubjectModelDownloading(error)
					? "Cut out is still downloading. Try again in a moment."
					: errorMessage(error),
			);
		} finally {
			busy.current = false;
			setFinding(null);
		}
	};

	const invert = async (layer: ImageLayer) => {
		const current = latest(layer.id);
		if (!current || !isCutOut(current) || busy.current) return;
		busy.current = true;
		setInverting(true);
		try {
			const bytes =
				current.mask === undefined
					? await invertedMask(undefined)
					: await withMask(current.mask, invertedMask);
			const kept = await keep(writeTemporaryPng(bytes));
			// Cut another way meanwhile, the inverse no longer fits.
			const now = latest(layer.id);
			if (
				now?.mask !== current.mask ||
				now?.maskStrokes !== current.maskStrokes
			) {
				return;
			}
			forgetPick();
			onInvert(layer.id, kept);
			setNews("Cut inverted");
		} catch (error) {
			setNews(null);
			showAlert("Couldn't invert the cut", errorMessage(error));
		} finally {
			busy.current = false;
			setInverting(false);
		}
	};

	return {
		canFind: isCutOutAvailable(),
		finding,
		inverting,
		news,
		find,
		invert,
	};
}

class PickOvertaken extends Error {}

/**
 * A first pick at `at` on `image`, as it is now: the objects found there,
 * and whether it adds to the image's mask or takes out of it. Null when
 * nothing was found.
 */
async function newPick(
	image: ImageLayer,
	at: ImagePoint,
): Promise<Pick | null> {
	const objects = await findObjectMasks(image.uri, at);
	const masks = await decodeMasks(objects.masks.map(({ uri }) => uri));
	if (masks.length === 0) return null;
	const { mask } = image;
	try {
		const add =
			mask === undefined
				? null
				: !(await withMask(mask, (decoded) => cutShowsAt(image, decoded, at)));
		return {
			layerId: image.id,
			at,
			mask: "",
			masks,
			index: objects.likeliest,
			base: mask,
			add,
		};
	} catch (error) {
		for (const decoded of masks) decoded.dispose();
		throw error;
	}
}

/** What a pick did, for a screen reader: `grown` from the same tap's last. */
function pickNews({ index, add }: Pick, grown: boolean): string {
	if (grown) {
		return index === 0
			? "Selection back to the smallest part"
			: "Selection grown";
	}
	if (add === null) return "Subject picked";
	return add ? "Subject added" : "Subject removed";
}

/** Decodes found masks' files, deleting each once it's read. */
async function decodeMasks(uris: string[]): Promise<SkImage[]> {
	const masks: SkImage[] = [];
	try {
		for (const uri of uris) masks.push(await decodeImage(uri));
		return masks;
	} catch (error) {
		for (const mask of masks) mask.dispose();
		throw error;
	} finally {
		for (const uri of uris) deleteTemporaryFile(uri);
	}
}

/** Runs `use` with the image layer's mask at `uri`, decoded. */
async function withMask<T>(
	uri: string,
	use: (mask: SkImage) => Promise<T>,
): Promise<T> {
	const held = decodedImages.acquire(uri);
	try {
		return await use(await held.decoded);
	} finally {
		held.release();
	}
}

/** The mask a pick leaves its image with, as a grayscale PNG's bytes. */
function pickedMask({ masks, index, base, add }: Pick): Promise<Uint8Array> {
	const picked = masks[index];
	if (base === undefined) return combineMasks(null, picked, "add");
	return withMask(base, (mask) =>
		combineMasks(mask, picked, add === false ? "remove" : "add"),
	);
}
