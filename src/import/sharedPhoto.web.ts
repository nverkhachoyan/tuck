import { importPhoto, type PickedPhoto } from "./photoImport";

// The browser's counterpart to `sharedPhoto.ts`. A photo shared to the
// installed web app is posted to the service worker
// (`scripts/service-worker.js`), which keeps it in this cache and sends the
// page to home with its name.
const CACHE = "tuck-shared";

// A name the service worker picks, so a link can't reach anything else.
const NAME = /^[\w-]+$/;

/** Web has no app links: a share arrives as home's `shared` param. */
export function sharedPhotoName(_url: string): string | null {
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
