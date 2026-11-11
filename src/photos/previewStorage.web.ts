import type { PreviewStorage } from "./previewStorage";

const DATABASE = "tuck-previews";
const PREVIEWS = "previews";

let database: Promise<IDBDatabase> | null = null;
const activeUrls = new Map<string, string>();

function previewKey(projectId: string, file: string): IDBValidKey {
	return [projectId, file];
}

function projectKeys(projectId: string): IDBKeyRange {
	return IDBKeyRange.bound([projectId], [projectId, []]);
}

function openDatabase(): Promise<IDBDatabase> {
	if (!database) {
		const opening = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DATABASE, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(PREVIEWS);
			};
			request.onsuccess = () => {
				const opened = request.result;
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
		opening.catch(() => {
			if (database === opening) database = null;
		});
		database = opening;
	}
	return database;
}

async function run<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const transaction = (await openDatabase()).transaction([PREVIEWS], mode);
	const request = work(transaction.objectStore(PREVIEWS));
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve(request.result);
		transaction.onabort = () => reject(transaction.error);
	});
}

export const previewStorage: PreviewStorage = {
	async getPreviewUri(projectId: string, file: string): Promise<string | null> {
		const key = `${projectId}:${file}`;
		const active = activeUrls.get(key);
		if (active) return active;
		const blob: Blob | undefined = await run("readonly", (store) =>
			store.get(previewKey(projectId, file)),
		);
		if (!blob) return null;
		const url = URL.createObjectURL(blob);
		activeUrls.set(key, url);
		return url;
	},

	async savePreview(
		projectId: string,
		file: string,
		tempUri: string,
	): Promise<string> {
		const blob = await (await fetch(tempUri)).blob();
		await run("readwrite", (store) =>
			store.put(blob, previewKey(projectId, file)),
		);
		if (tempUri.startsWith("blob:")) URL.revokeObjectURL(tempUri);
		const key = `${projectId}:${file}`;
		const active = activeUrls.get(key);
		if (active) URL.revokeObjectURL(active);
		const url = URL.createObjectURL(blob);
		activeUrls.set(key, url);
		return url;
	},

	async copyPreview(fromId: string, file: string, toId: string): Promise<void> {
		const blob: Blob | undefined = await run("readonly", (store) =>
			store.get(previewKey(fromId, file)),
		);
		if (!blob) return;
		await run("readwrite", (store) => store.put(blob, previewKey(toId, file)));
	},

	async removeProjectPreviews(projectId: string): Promise<void> {
		await run("readwrite", (store) => store.delete(projectKeys(projectId)));
		for (const [key, url] of activeUrls) {
			if (key.startsWith(`${projectId}:`)) {
				URL.revokeObjectURL(url);
				activeUrls.delete(key);
			}
		}
	},
};

export default previewStorage;
