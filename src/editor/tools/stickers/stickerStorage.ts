import { Directory, File, Paths } from "expo-file-system";
import {
	parseStickerIndex,
	type SavedSticker,
	serializeStickerIndex,
	stickerFileName,
	withStickerUsed,
} from "./savedStickers";

// `stickerStorage.web.ts` implements the same API for browsers. Saved
// stickers are image files in one folder, listed in an index beside them.

const INDEX = "stickers.json";
const INDEX_DRAFT = "stickers.json.tmp";

const stickersDirectory = () => new Directory(Paths.document, "stickers");

// Each change reads the index and writes it back, so they go one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(work: () => Promise<T>): Promise<T> {
	const next = queue.then(work, work);
	queue = next.catch(() => {});
	return next;
}

async function readIndex(): Promise<SavedSticker[]> {
	const file = new File(stickersDirectory(), INDEX);
	return parseStickerIndex(file.exists ? await file.text() : null);
}

/** Writes a draft first, so a save that's cut short can't leave half a file. */
function writeIndex(stickers: SavedSticker[]) {
	const directory = stickersDirectory();
	const draft = new File(directory, INDEX_DRAFT);
	draft.create({ overwrite: true });
	draft.writeSync(serializeStickerIndex(stickers));
	draft.moveSync(new File(directory, INDEX), { overwrite: true });
}

/** The saved stickers, most recently used first. */
export function listStickers(): Promise<SavedSticker[]> {
	return serially(readIndex);
}

/** Moves the image at `uri` into the stickers as `sticker`. */
export function addSticker(sticker: SavedSticker, uri: string): Promise<void> {
	return serially(async () => {
		const directory = stickersDirectory();
		directory.create({ intermediates: true, idempotent: true });
		await new File(uri).move(new File(directory, stickerFileName(sticker)), {
			overwrite: true,
		});
		writeIndex([sticker, ...(await readIndex())]);
	});
}

export function markStickerUsed(id: string, usedAt: number): Promise<void> {
	return serially(async () => {
		writeIndex(withStickerUsed(await readIndex(), id, usedAt));
	});
}

export function removeSticker(sticker: SavedSticker): Promise<void> {
	return serially(async () => {
		writeIndex((await readIndex()).filter(({ id }) => id !== sticker.id));
		const image = new File(stickersDirectory(), stickerFileName(sticker));
		if (image.exists) image.delete();
	});
}

export async function stickerUrl(sticker: SavedSticker): Promise<string> {
	return new File(stickersDirectory(), stickerFileName(sticker)).uri;
}

/** Nothing to free: a sticker's URL is a file path. */
export function releaseStickerUrl(_url: string) {}

/**
 * A copy of the sticker's image for a project, which moves it into its own
 * folder.
 */
export async function stickerImageCopy(sticker: SavedSticker): Promise<string> {
	const image = new File(stickersDirectory(), stickerFileName(sticker));
	if (!image.exists) throw new Error("This sticker's image is missing.");
	const copy = new File(
		Paths.cache,
		`${Date.now().toString(36)}-${stickerFileName(sticker)}`,
	);
	await image.copy(copy);
	return copy.uri;
}
