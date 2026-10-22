import { PHOTO_FILE } from "./projectFile";
import { MISSING_IMAGE_MESSAGE, type ProjectStorage } from "./projectLifecycle";

// Browsers give the app no file system to keep projects in, so they live in
// IndexedDB: each project's JSON in one store, and its image files' bytes,
// if it has any, in another.
// A transaction either completes or leaves nothing, so saves need no draft.

const DATABASE = "tuck";
const PROJECTS = "projects";
const PHOTOS = "photos";

// Where an image file is kept in PHOTOS. A project's `PHOTO_FILE` is under
// its id, where builds from before added photos look for it; any other file
// is under [id, file].
function imageKey(id: string, file: string): IDBValidKey {
	return file === PHOTO_FILE ? id : [id, file];
}

// Every [id, file] key of one project: arrays sort after strings, so [id, []]
// comes after all of them.
function addedImageKeys(id: string): IDBKeyRange {
	return IDBKeyRange.bound([id], [id, []]);
}

let database: Promise<IDBDatabase> | null = null;
let askedToPersist = false;
const heldLocks = new Map<
	string,
	{ release: () => void; finished: Promise<void> }
>();
const lockName = (id: string) => `tuck-project-${id}`;

/** Keep a project claimed until its editor closes, including across tabs. */
export async function claimProject(id: string): Promise<boolean> {
	if (!navigator.locks) return true;
	if (heldLocks.has(id)) return false;
	return new Promise<boolean>((resolve, reject) => {
		const request = navigator.locks.request(
			lockName(id),
			{ ifAvailable: true },
			async (lock) => {
				if (!lock) {
					resolve(false);
					return;
				}
				await new Promise<void>((release) => {
					heldLocks.set(id, {
						release,
						finished: request.then(
							() => {},
							() => {},
						),
					});
					resolve(true);
				});
			},
		);
		void request.catch(reject);
	});
}

export async function releaseProject(id: string) {
	const held = heldLocks.get(id);
	if (!held) return;
	heldLocks.delete(id);
	held.release();
	await held.finished;
}

function openDatabase(): Promise<IDBDatabase> {
	if (!database) {
		const opening = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DATABASE, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(PROJECTS);
				request.result.createObjectStore(PHOTOS);
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
	stores: string[],
	mode: IDBTransactionMode,
	work: (transaction: IDBTransaction) => IDBRequest<T>,
): Promise<T> {
	const transaction = (await openDatabase()).transaction(stores, mode);
	const request = work(transaction);
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve(request.result);
		// A failed request aborts the transaction, which by then holds the error.
		transaction.onabort = () => reject(transaction.error);
	});
}

/** Copies a picked photo into a project as `file`, and returns a URL for it. */
export async function storeImage(
	id: string,
	file: string,
	uri: string,
): Promise<string> {
	const blob = await (await fetch(uri)).blob();
	await run([PHOTOS], "readwrite", (t) =>
		t.objectStore(PHOTOS).put(blob, imageKey(id, file)),
	);
	// The picker's URL keeps its own copy of the photo alive until revoked.
	if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
	return URL.createObjectURL(blob);
}

export async function copyImage(fromId: string, file: string, toId: string) {
	const blob: Blob | undefined = await run([PHOTOS], "readonly", (t) =>
		t.objectStore(PHOTOS).get(imageKey(fromId, file)),
	);
	if (!blob) throw new Error(MISSING_IMAGE_MESSAGE);
	await run([PHOTOS], "readwrite", (t) =>
		t.objectStore(PHOTOS).put(blob, imageKey(toId, file)),
	);
}

export async function imageUrl(id: string, file: string): Promise<string> {
	const blob: Blob | undefined = await run([PHOTOS], "readonly", (t) =>
		t.objectStore(PHOTOS).get(imageKey(id, file)),
	);
	if (!blob) throw new Error(MISSING_IMAGE_MESSAGE);
	return URL.createObjectURL(blob);
}

/** Frees a URL from `storeImage` or `imageUrl` once nothing shows it. */
export function releaseImage(url: string) {
	URL.revokeObjectURL(url);
}

export async function listImages(id: string): Promise<string[]> {
	const [photos, added] = await Promise.all([
		run([PHOTOS], "readonly", (t) => t.objectStore(PHOTOS).count(id)),
		run([PHOTOS], "readonly", (t) =>
			t.objectStore(PHOTOS).getAllKeys(addedImageKeys(id)),
		),
	]);
	return [
		...(photos > 0 ? [PHOTO_FILE] : []),
		...added.flatMap((key) => (Array.isArray(key) ? [String(key[1])] : [])),
	];
}

export async function removeImage(id: string, file: string) {
	await run([PHOTOS], "readwrite", (t) =>
		t.objectStore(PHOTOS).delete(imageKey(id, file)),
	);
}

/** The project's JSON, or null if it was never saved. */
export async function readProjectFile(id: string): Promise<string | null> {
	const json: string | undefined = await run([PROJECTS], "readonly", (t) =>
		t.objectStore(PROJECTS).get(id),
	);
	return json ?? null;
}

export async function writeProjectFile(id: string, json: string) {
	// Asks the browser not to clear projects when it's short on space, once
	// there's one worth keeping. It may still say no; Firefox asks the user.
	if (!askedToPersist) {
		askedToPersist = true;
		void navigator.storage?.persist?.();
	}
	await run([PROJECTS], "readwrite", (t) =>
		t.objectStore(PROJECTS).put(json, id),
	);
}

export async function removeProject(id: string) {
	await run([PROJECTS, PHOTOS], "readwrite", (t) => {
		t.objectStore(PROJECTS).delete(id);
		t.objectStore(PHOTOS).delete(id);
		return t.objectStore(PHOTOS).delete(addedImageKeys(id));
	});
}

/** Only clean a project if no tab can still be editing it. */
export async function removeInactiveProject(
	id: string,
	shouldRemove: (json: string | null) => boolean,
) {
	// Without Web Locks, keeping an orphan is safer than deleting a live project.
	if (!navigator.locks) return;
	await navigator.locks.request(
		lockName(id),
		{ ifAvailable: true },
		async (lock) => {
			if (lock && shouldRemove(await readProjectFile(id))) {
				await removeProject(id);
			}
		},
	);
}

export async function listProjectIds(): Promise<string[]> {
	const keys = await Promise.all(
		[PROJECTS, PHOTOS].map((store) =>
			run([store], "readonly", (t) => t.objectStore(store).getAllKeys()),
		),
	);
	// Older builds delete only a project's own key, leaving its [id, file]
	// images behind; listing them finds the project to clean up.
	const ids = keys
		.flat()
		.map((key) => String(Array.isArray(key) ? key[0] : key));
	return [...new Set(ids)];
}

// Checked against the shared contract here, so a drift from it fails in
// this file rather than at the wiring in `projectService.ts`.
const storage: ProjectStorage = {
	claimProject,
	releaseProject,
	storeImage,
	copyImage,
	imageUrl,
	releaseImage,
	listImages,
	removeImage,
	readProjectFile,
	writeProjectFile,
	removeProject,
	removeInactiveProject,
	listProjectIds,
};

export default storage;
