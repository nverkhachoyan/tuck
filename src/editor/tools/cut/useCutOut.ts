import { useEffect, useRef, useState } from "react";
import type { SkImage } from "react-native-skia";
import {
	deleteTemporaryFile,
	writeTemporaryPng,
} from "@/platform/temporaryFile";
import { errorMessage } from "@/ui/errorMessage";
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
import type { ImageLayer } from "../../layers/image/image";
import { isCutOut } from "../../layers/image/mask";
import { decodedImages, decodeImage } from "../../render/decodedImages";
import { combineMasks, invertedMask } from "./cutMask";
import { type LastPick, nextMask, picksAgain } from "./pickGrowth";

/**
 * The last pick, kept to grow or shrink it: the masks found where it was
 * tapped, the one it took, the image's mask before it (`base`), and whether
 * it added to that or took out of it.
 */
type Pick = LastPick & {
	masks: SkImage[];
	index: number;
	base: string | undefined;
	add: boolean;
};

/** Which of the last pick's masks it took, of how many, and the mask it left. */
export type PickSize = { mask: string; index: number; count: number };

/**
 * Selects what to cut out of `image`, and turns a selection inside out. The
 * selection is the image's mask while Cut is open; one that selects nothing
 * is `emptyMask`, a black pixel stretched over the image.
 * - `findAll` adds every subject to the selection. Every subject found once
 *   is used again while the session's `key` stays the same, since its
 *   project keeps the file until it closes.
 * - `pick` adds the subject at a point, or once Segment Anything is ready,
 *   any object there, or takes it out of the selection. Another tap on the
 *   same spot grows what it took, from a part to the whole and around
 *   again, and `resize` steps it a size larger or smaller (`pickSize`, while
 *   the selection is what it left).
 * - While `picking`, the image is read ahead for that.
 * - `clear` selects nothing, and `invert` turns the selection inside out
 *   (`inverting` meanwhile).
 * - `latest` is the image as it is by then, which each of these changes.
 * - A new mask goes to `onMask` once `keep` has put its file where the
 *   document can use it, saying whether to keep the strokes that refined
 *   the selection; `onMask` decides whether the image still wants it.
 *   Inverting goes to `onInvert`.
 * - `finding` says which is being found, while one is. Only one of these
 *   runs at a time: another meanwhile does nothing.
 * - `news` says what the last one did, for a screen reader.
 * - `canFind` is false while this device can't find subjects, when only the
 *   brushes select.
 */
export function useCutOut({
	key,
	image,
	picking,
	latest,
	keep,
	onMask,
	onInvert,
}: {
	key: string | null;
	image: ImageLayer | undefined;
	picking: boolean;
	latest: (layerId: string) => ImageLayer | undefined;
	keep: (uri: string) => Promise<string>;
	onMask: (layerId: string, mask: string, keepStrokes: boolean) => void;
	onInvert: (layerId: string, mask: string) => void;
}) {
	const [finding, setFinding] = useState<"all" | "one" | null>(null);
	const [inverting, setInverting] = useState(false);
	const [news, setNews] = useState<string | null>(null);
	const [pickSize, setPickSize] = useState<PickSize | null>(null);
	const [emptyMask, setEmptyMask] = useState<{
		key: string | null;
		uri: string;
	} | null>(null);
	const busy = useRef(false);
	// The mask of every subject found for each image file in this session,
	// and the one that selects nothing.
	const found = useRef({
		key,
		masks: new Map<string, string>(),
		empty: null as Promise<string> | null,
	});
	if (found.current.key !== key) {
		found.current = { key, masks: new Map(), empty: null };
	}
	const lastPick = useRef<Pick | null>(null);
	const forgetPick = () => {
		for (const mask of lastPick.current?.masks ?? []) mask.dispose();
		lastPick.current = null;
		setPickSize(null);
	};

	const uri = image?.uri;
	useEffect(() => {
		if (uri !== undefined && picking) prepareObjectSelection(uri);
	}, [uri, picking]);
	// Put down, or moved to another image, Cut lets go of what it read.
	useEffect(() => {
		if (uri === undefined) return;
		return () => {
			for (const mask of lastPick.current?.masks ?? []) mask.dispose();
			lastPick.current = null;
			releaseObjectSelection();
		};
	}, [uri]);

	const keepEmptyMask = () => {
		const session = found.current;
		if (!session.empty) {
			const made = invertedMask(undefined)
				.then((bytes) => keep(writeTemporaryPng(bytes)))
				.then((uri) => {
					setEmptyMask({ key: session.key, uri });
					return uri;
				});
			// A failed write is tried again next time.
			made.catch(() => {
				if (session.empty === made) session.empty = null;
			});
			session.empty = made;
		}
		return session.empty;
	};

	// Runs `task` unless another is running, saying which is being found.
	const exclusive = async (
		kind: "all" | "one" | null,
		task: () => Promise<void>,
	) => {
		if (busy.current) return;
		busy.current = true;
		setFinding(kind);
		try {
			await task();
		} catch (error) {
			setNews(null);
			showAlert(
				"Couldn't select that",
				isSubjectModelDownloading(error)
					? "Cut is still downloading. Try again in a moment."
					: errorMessage(error),
			);
		} finally {
			busy.current = false;
			setFinding(null);
		}
	};

	const findAll = (layer: ImageLayer) =>
		exclusive("all", async () => {
			setNews("Finding the subjects");
			let subject = found.current.masks.get(layer.uri);
			if (subject === undefined) {
				const mask = await findSubjectMask(layer.uri);
				if (!mask) {
					setNews(null);
					showAlert(
						"Nothing to select",
						"There's no clear subject in front of the background.",
					);
					return;
				}
				subject = await keep(mask.uri);
				found.current.masks.set(layer.uri, subject);
			}
			const current = latest(layer.id);
			if (!current) return;
			const empty = found.current.empty && (await found.current.empty);
			const base = current.mask;
			const kept =
				base === undefined || base === empty
					? subject
					: await keep(
							writeTemporaryPng(
								await withMask(base, (mask) =>
									withMask(subject, (found) =>
										combineMasks(mask, found, "add"),
									),
								),
							),
						);
			// Cut another way meanwhile, the subjects no longer fit.
			if (latest(layer.id)?.mask !== base) return;
			forgetPick();
			onMask(layer.id, kept, true);
			setNews("Subjects selected");
		});

	// Leaves the image with `next`'s mask, `grown` from the last pick.
	const applyPick = async (current: ImageLayer, next: Pick, grown: boolean) => {
		let kept: string;
		try {
			kept = await keep(writeTemporaryPng(await pickedMask(next)));
			// Cut another way meanwhile, the pick no longer fits.
			if (latest(current.id)?.mask !== current.mask) {
				throw new PickOvertaken();
			}
		} catch (error) {
			if (!grown) for (const mask of next.masks) mask.dispose();
			if (error instanceof PickOvertaken) return;
			throw error;
		}
		onMask(current.id, kept, true);
		lastPick.current = { ...next, mask: kept };
		setPickSize(
			next.masks.length > 1
				? { mask: kept, index: next.index, count: next.masks.length }
				: null,
		);
	};

	const pick = (layer: ImageLayer, at: ImagePoint, add: boolean) =>
		exclusive("one", async () => {
			const current = latest(layer.id);
			if (!current) return;
			const last = lastPick.current;
			if (last && last.masks.length > 1 && picksAgain(last, current, at)) {
				const index = nextMask(last.index, last.masks.length);
				await applyPick(current, { ...last, index }, true);
				setNews(
					index === 0
						? "Selection back to the smallest part"
						: "Selection grown",
				);
				return;
			}
			forgetPick();
			setNews("Finding the object");
			const next = await newPick(current, at, add);
			if (!next) {
				setNews(null);
				showAlert(
					"Nothing to select",
					"There's no clear subject where you tapped. Try the middle of it, or paint the selection with Add and Subtract.",
				);
				return;
			}
			await applyPick(current, next, false);
			setNews(add ? "Added to the selection" : "Taken out of the selection");
		});

	const resize = (layer: ImageLayer, step: 1 | -1) =>
		exclusive("one", async () => {
			const current = latest(layer.id);
			const last = lastPick.current;
			if (!current || !last || current.mask !== last.mask) return;
			const index = last.index + step;
			if (index < 0 || index >= last.masks.length) return;
			await applyPick(current, { ...last, index }, true);
			setNews(step > 0 ? "Selection grown" : "Selection shrunk");
		});

	const clear = (layer: ImageLayer, announce: boolean) =>
		exclusive(null, async () => {
			const empty = await keepEmptyMask();
			forgetPick();
			onMask(layer.id, empty, false);
			setNews(announce ? "Selection cleared" : null);
		});

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
			setNews("Selection inverted");
		} catch (error) {
			setNews(null);
			showAlert("Couldn't invert the selection", errorMessage(error));
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
		emptyMask: emptyMask?.key === key ? emptyMask.uri : null,
		pickSize,
		keepEmptyMask,
		findAll,
		pick,
		resize,
		clear,
		invert,
	};
}

class PickOvertaken extends Error {}

/**
 * A first pick at `at` on `image`, as it is now, adding to its mask or
 * taking out of it: the objects found there, or null when nothing was.
 */
async function newPick(
	image: ImageLayer,
	at: ImagePoint,
	add: boolean,
): Promise<Pick | null> {
	const objects = await findObjectMasks(image.uri, at);
	const masks = await decodeMasks(objects.masks.map(({ uri }) => uri));
	if (masks.length === 0) return null;
	return {
		layerId: image.id,
		at,
		mask: "",
		masks,
		index: objects.likeliest,
		base: image.mask,
		add,
	};
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

/** Runs `use` with the mask at `uri`, decoded. */
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
	const mode = add ? "add" : "remove";
	if (base === undefined) return combineMasks(null, picked, mode);
	return withMask(base, (mask) => combineMasks(mask, picked, mode));
}
