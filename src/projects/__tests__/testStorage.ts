/// <reference types="node" />
import assert from "node:assert/strict";
import {
	createImageLayer,
	createTextLayer,
	type EditorDocument,
	type ImageLayer,
} from "../../editor/core.ts";
import {
	createOpenProjects,
	type PrepareProjectPreviews,
	type ProjectStorage,
	type StoreProjectPreview,
} from "../openProjects.ts";
import { parseSavedProject } from "../projectFile.ts";
import {
	type CopyProjectPreviews,
	createProjectLibrary,
	type RemoveProjectPreviews,
} from "../projectLibrary.ts";

export type Write = (
	id: string,
	json: string,
	files: Map<string, string>,
) => Promise<void>;

export function createProjectLifecycle(
	storage: ProjectStorage,
	preparePreviews?: PrepareProjectPreviews,
	removePreviews?: RemoveProjectPreviews,
	storePreview?: StoreProjectPreview,
	copyPreviews?: CopyProjectPreviews,
) {
	const { coordination, ...openProjects } = createOpenProjects(
		storage,
		preparePreviews,
		storePreview,
	);
	const library = createProjectLibrary(
		storage,
		coordination,
		removePreviews,
		copyPreviews,
	);
	return { ...openProjects, ...library };
}

// Storage in memory, with every write going through `write`. An image's URL
// is `blob:<project>/<file>`.
export function createHarness(
	write: Write = async (id, json, files) => {
		files.set(id, json);
	},
	// When a read should see something other than the saved file, such as a
	// file another tab is in the middle of replacing.
	read?: (id: string, files: Map<string, string>) => Promise<string | null>,
	preparePreviews?: PrepareProjectPreviews,
	removePreviews?: RemoveProjectPreviews,
	storePreview?: StoreProjectPreview,
) {
	const files = new Map<string, string>();
	// Each project's image files; a project with none has no entry.
	const images = new Map<string, Set<string>>();
	const released: string[] = [];
	const copiedPreviews: { fromId: string; toId: string; files: Set<string> }[] =
		[];
	const copyPreviews: CopyProjectPreviews = async (fromId, toId, files) => {
		copiedPreviews.push({ fromId, toId, files: new Set(files) });
	};
	// Projects another tab holds open, which can't be claimed here.
	const openElsewhere = new Set<string>();
	let copyImage: ProjectStorage["copyImage"] = async (fromId, file, toId) => {
		if (!images.get(fromId)?.has(file)) throw new Error("Missing image");
		images.set(toId, new Set(images.get(toId)).add(file));
	};
	let writes = 0;
	const remove = (id: string) => {
		files.delete(id);
		images.delete(id);
	};
	const storage: ProjectStorage = {
		async claimProject(id) {
			return !openElsewhere.has(id);
		},
		async releaseProject() {},
		async storeImage(id, file) {
			images.set(id, new Set(images.get(id)).add(file));
			return `blob:${id}/${file}`;
		},
		copyImage: (fromId, file, toId) => copyImage(fromId, file, toId),
		async imageUrl(id, file) {
			if (!images.get(id)?.has(file)) throw new Error("Missing image");
			return `blob:${id}/${file}`;
		},
		releaseImage(url) {
			released.push(url);
		},
		async listImages(id) {
			return [...(images.get(id) ?? [])];
		},
		async removeImage(id, file) {
			const kept = images.get(id);
			kept?.delete(file);
			if (kept?.size === 0) images.delete(id);
		},
		async readProjectFile(id) {
			if (read) return read(id, files);
			return files.get(id) ?? null;
		},
		async writeProjectFile(id, json) {
			writes++;
			await write(id, json, files);
		},
		async removeProject(id) {
			remove(id);
		},
		async removeInactiveProject(id, shouldRemove) {
			if (shouldRemove(files.get(id) ?? null)) remove(id);
		},
		async listProjectIds() {
			return [...new Set([...images.keys(), ...files.keys()])];
		},
	};
	return {
		projects: createProjectLifecycle(
			storage,
			preparePreviews,
			removePreviews,
			storePreview,
			copyPreviews,
		),
		// A new session over the same storage, as after a reload or the app
		// being killed: whatever was open was never closed.
		restart() {
			this.projects = createProjectLifecycle(
				storage,
				preparePreviews,
				removePreviews,
				storePreview,
				copyPreviews,
			);
		},
		files,
		images,
		released,
		copiedPreviews,
		openElsewhere,
		set copyImage(copy: ProjectStorage["copyImage"]) {
			copyImage = copy;
		},
		get writes() {
			return writes;
		},
	};
}

export const photo = { uri: "picked", width: 400, height: 300, opaque: true };
export const canvas = { width: 1080, height: 1080, background: "#FFFFFF" };

export const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export function addText(
	document: EditorDocument,
	text: string,
): EditorDocument {
	return {
		...document,
		layers: [...document.layers, createTextLayer(document, text)],
	};
}

export function addPhoto(
	document: EditorDocument,
	url: string,
): EditorDocument {
	return {
		...document,
		layers: [
			...document.layers,
			createImageLayer(document, url, 400, 300, true),
		],
	};
}

export const imageLayers = (document: EditorDocument | null | undefined) =>
	(document?.layers ?? []).filter(
		(layer): layer is ImageLayer => layer.type === "image",
	);

export function savedProject(
	harness: ReturnType<typeof createHarness>,
	id: string,
) {
	const saved = parseSavedProject(harness.files.get(id) ?? "");
	assert.ok(saved);
	return saved;
}

// A project with one saved edit, closed.
export async function createSavedProject(
	harness: ReturnType<typeof createHarness>,
) {
	const { id, document } = await harness.projects.createProject(photo);
	await harness.projects.closeProject(id, addText(document, "CAPTION"));
	return id;
}
