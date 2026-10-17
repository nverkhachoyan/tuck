import { importPhoto, type PickedPhoto } from "./photoImport";

// The browser's counterpart to `sharedPhoto.ts`. A photo shared to the
// installed web app is posted to the service worker
// (`scripts/service-worker.js`), which keeps it in this cache and sends the
// page to home with its name. A photo opened with the app is kept here too,
// so both open the same way.
const CACHE = "tuck-shared";

// A name picked here or by the service worker, so a link can't reach
// anything else.
const NAME = /^[\w-]+$/;

/** Web has no app links: a share arrives as home's `shared` param. */
export function sharedPhotoName(_url: string): string | null {
	return null;
}

// What the browser hands an installed app opened with a file, as through
// "Open with" on the desktop (the manifest's `file_handlers`). TypeScript's
// DOM types don't have it yet.
type LaunchQueue = {
	setConsumer(
		consumer: (params: { files: readonly FileSystemHandle[] }) => void,
	): void;
};

let onLaunch: ((name: string) => void) | null = null;
let consuming = false;

/**
 * Hands `listener` the name of each photo the app is opened with, kept like
 * a shared one. The browser holds a launch's files until something takes
 * them, so they wait for the first listener. Returns a function that stops.
 */
export function listenForLaunchedPhotos(
	listener: (name: string) => void,
): () => void {
	const launchQueue = (window as { launchQueue?: LaunchQueue }).launchQueue;
	onLaunch = listener;
	if (launchQueue && !consuming) {
		consuming = true;
		launchQueue.setConsumer(({ files }) => {
			keepLaunchedPhoto(files).then(
				(name) => {
					if (name) onLaunch?.(name);
				},
				(error: unknown) => {
					console.warn("Couldn't keep the opened photo", error);
				},
			);
		});
	}
	return () => {
		if (onLaunch === listener) onLaunch = null;
	};
}

// The first image among the files, kept as the service worker keeps a
// shared photo: under a new name, in place of any not yet opened.
async function keepLaunchedPhoto(
	handles: readonly FileSystemHandle[],
): Promise<string | null> {
	for (const handle of handles) {
		if (handle.kind !== "file") continue;
		const file = await (handle as FileSystemFileHandle).getFile();
		if (!file.type.startsWith("image/")) continue;
		const name = crypto.randomUUID();
		const cache = await caches.open(CACHE);
		for (const key of await cache.keys()) await cache.delete(key);
		await cache.put(
			`/shared-photos/${name}`,
			new Response(file, { headers: { "Content-Type": file.type } }),
		);
		return name;
	}
	return null;
}

/**
 * A shared photo, made ready for the editor like a picked one. The kept copy
 * is deleted either way. Throws if it's gone or can't be read.
 */
export async function importSharedPhoto(name: string): Promise<PickedPhoto> {
	const key = `/shared-photos/${name}`;
	const cache =
		"caches" in globalThis && NAME.test(name) ? await caches.open(CACHE) : null;
	const response = await cache?.match(key);
	if (!cache || !response) {
		throw new Error("The photo is no longer there. Try sharing it again.");
	}
	const uri = URL.createObjectURL(await response.blob());
	try {
		return await importPhoto(uri);
	} finally {
		URL.revokeObjectURL(uri);
		cache.delete(key).catch((error: unknown) => {
			console.warn("Couldn't delete the shared photo", error);
		});
	}
}
