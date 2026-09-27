import {
	isSavedSticker,
	recentFirst,
	type SavedSticker,
} from "./savedStickers";

// Browsers give the app no file system, so saved stickers live in IndexedDB,
// each as one record holding its details and its image's bytes. They're in
// a database of their own, so adding them didn't mean upgrading the
// projects' database under another open tab.

const DATABASE = "photo-editor-stickers";
const STICKERS = "stickers";

type StickerRecord = { sticker: SavedSticker; image: Blob };

let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (!database) {
		const opening = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DATABASE, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(STICKERS);
			};
			request.onsuccess = () => {
				const opened = request.result;
				// Let a newer version of the app, open in another tab, upgrade it.
				opened.onversionchange = () => {
					opened.close();
					if (database === opening) database = null;
				};
				resolve(opened);
			};
			request.onerror = () => reject(request.error);
			request.onblocked = () =>
				reject(new Error("Close this app's other tabs, then try again."));
		});
		// A failed open is tried again next time.
		opening.catch(() => {
			if (database === opening) database = null;
		});
		database = opening;
	}
	return database;
}

/** Runs `work` in a transaction, and resolves with its request's result once committed. */
async function run<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const transaction = (await openDatabase()).transaction([STICKERS], mode);
	const request = work(transaction.objectStore(STICKERS));
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve(request.result);
		// A failed request aborts the transaction, which by then holds the error.
		transaction.onabort = () => reject(transaction.error);
	});
}

async function readRecord(id: string): Promise<StickerRecord> {
	const record: unknown = await run("readonly", (store) => store.get(id));
	if (!isRecord(record)) throw new Error("This sticker's image is missing.");
	return record;
}

function isRecord(value: unknown): value is StickerRecord {
	return (
		typeof value === "object" &&
		value !== null &&
		isSavedSticker((value as StickerRecord).sticker) &&
		(value as StickerRecord).image instanceof Blob
	);
}

/** The saved stickers, most recently used first. */
export async function listStickers(): Promise<SavedSticker[]> {
	const records: unknown[] = await run("readonly", (store) => store.getAll());
	return recentFirst(records.filter(isRecord).map(({ sticker }) => sticker));
}

/** Copies the image at `uri` into the stickers as `sticker`. */
export async function addSticker(sticker: SavedSticker, uri: string) {
	const image = await (await fetch(uri)).blob();
	await run("readwrite", (store) =>
		store.put({ sticker, image } satisfies StickerRecord, sticker.id),
	);
	// Handed over, like a picked photo's: its URL keeps a copy alive until
	// revoked.
	if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}

export async function markStickerUsed(id: string, usedAt: number) {
	const record = await readRecord(id);
	await run("readwrite", (store) =>
		store.put({ ...record, sticker: { ...record.sticker, usedAt } }, id),
	);
}

export async function removeSticker(sticker: SavedSticker) {
	await run("readwrite", (store) => store.delete(sticker.id));
}

/** A URL to show the sticker's image by, until `releaseStickerUrl`. */
export async function stickerUrl(sticker: SavedSticker): Promise<string> {
	return URL.createObjectURL((await readRecord(sticker.id)).image);
}

export function releaseStickerUrl(url: string) {
	URL.revokeObjectURL(url);
}

/**
 * A URL of its own for the sticker's image, for a project to copy from and
 * then revoke.
 */
export async function stickerImageCopy(sticker: SavedSticker): Promise<string> {
	return stickerUrl(sticker);
}
