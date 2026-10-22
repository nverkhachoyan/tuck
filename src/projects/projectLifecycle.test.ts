/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { withMask } from "../model/cutout.ts";
import {
	createImageLayer,
	createTextLayer,
	type EditorDocument,
	type ImageLayer,
} from "../model/document.ts";
import {
	isImageFile,
	PHOTO_FILE,
	PROJECT_VERSION,
	parseSavedProject,
	type SavedProject,
} from "./projectFile.ts";
import {
	createProjectLifecycle,
	type ProjectStorage,
} from "./projectLifecycle.ts";

type Write = (
	id: string,
	json: string,
	files: Map<string, string>,
) => Promise<void>;

// Storage in memory, with every write going through `write`. An image's URL
// is `blob:<project>/<file>`.
function createHarness(
	write: Write = async (id, json, files) => {
		files.set(id, json);
	},
) {
	const files = new Map<string, string>();
	// Each project's image files; a project with none has no entry.
	const images = new Map<string, Set<string>>();
	const released: string[] = [];
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
		projects: createProjectLifecycle(storage),
		// A new session over the same storage, as after a reload or the app
		// being killed: whatever was open was never closed.
		restart() {
			this.projects = createProjectLifecycle(storage);
		},
		files,
		images,
		released,
		openElsewhere,
		set copyImage(copy: ProjectStorage["copyImage"]) {
			copyImage = copy;
		},
		get writes() {
			return writes;
		},
	};
}

const photo = { uri: "picked", width: 400, height: 300, opaque: true };
const canvas = { width: 1080, height: 1080, background: "#FFFFFF" };

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function addText(document: EditorDocument, text: string): EditorDocument {
	return {
		...document,
		layers: [...document.layers, createTextLayer(document, text)],
	};
}

function addPhoto(document: EditorDocument, url: string): EditorDocument {
	return {
		...document,
		layers: [
			...document.layers,
			createImageLayer(document, url, 400, 300, true),
		],
	};
}

const imageLayers = (document: EditorDocument | null | undefined) =>
	(document?.layers ?? []).filter(
		(layer): layer is ImageLayer => layer.type === "image",
	);

function savedProject(harness: ReturnType<typeof createHarness>, id: string) {
	const saved = parseSavedProject(harness.files.get(id) ?? "");
	assert.ok(saved);
	return saved;
}

// A project with one saved edit, closed.
async function createSavedProject(harness: ReturnType<typeof createHarness>) {
	const { id, document } = await harness.projects.createProject(photo);
	await harness.projects.closeProject(id, addText(document, "CAPTION"));
	return id;
}

describe("autosave", () => {
	test("a failed autosave stays pending and a retry saves it", async (t) => {
		t.mock.method(console, "warn", () => {});
		let fail = true;
		const harness = createHarness(async (id, json, files) => {
			if (fail) throw new Error("Storage unavailable");
			files.set(id, json);
		});
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		projects.queueAutosave(id, addText(document, "FIRST"));
		projects.flushAutosave();
		await tick();
		assert.equal(harness.files.size, 0);
		assert.equal(
			projects.getAutosaveError(),
			"Your latest edits couldn't be saved.",
		);

		fail = false;
		projects.flushAutosave();
		await tick();
		assert.equal(harness.writes, 2);
		assert.equal(savedProject(harness, id).document.layers.length, 2);
		assert.equal(projects.getAutosaveError(), null);
	});

	test("a failed older write cannot overwrite a newer saved edit", async (t) => {
		t.mock.method(console, "warn", () => {});
		let rejectFirst: ((reason: Error) => void) | undefined;
		const harness = createHarness(async (id, json, files) => {
			if (!rejectFirst) {
				await new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
				return;
			}
			files.set(id, json);
		});
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		const first = addText(document, "FIRST");
		projects.queueAutosave(id, first);
		projects.flushAutosave();
		await tick();
		assert.ok(rejectFirst);
		const textLayer = first.layers[1];
		assert.ok(textLayer.type === "text");

		const second: EditorDocument = {
			...first,
			layers: [first.layers[0], { ...textLayer, text: "SECOND" }],
		};
		projects.queueAutosave(id, second);
		projects.flushAutosave();
		rejectFirst(new Error("First write failed"));
		await tick();
		await tick();
		projects.flushAutosave();
		await tick();
		assert.equal(harness.writes, 2);
		const savedLayer = savedProject(harness, id).document.layers[1];
		assert.ok(savedLayer.type === "text");
		assert.equal(savedLayer.text, "SECOND");
		assert.equal(projects.getAutosaveError(), null);
	});
});

describe("closing and reopening", () => {
	test("closing a photo that was never edited removes its project", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(id, document);
		assert.equal(harness.images.size, 0);
		assert.deepEqual(await harness.projects.listProjects(), []);
	});

	test("closing saves the last edits, and the project is listed", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const [listed] = await harness.projects.listProjects();
		assert.equal(listed.id, id);
		assert.ok(listed.status === "ready");
		assert.equal(listed.label, "CAPTION");
	});

	test("reopening and closing unchanged doesn't save again", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const { updatedAt } = savedProject(harness, id);
		const document = await harness.projects.openProject(id);
		assert.ok(document);
		await harness.projects.closeProject(id, document);
		assert.equal(harness.writes, 1);
		assert.equal(savedProject(harness, id).updatedAt, updatedAt);
	});

	test("a reopened project is kept when its edits are removed", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const document = await harness.projects.openProject(id);
		assert.ok(document);
		await harness.projects.closeProject(id, {
			...document,
			layers: [document.layers[0]],
		});
		const [listed] = await harness.projects.listProjects();
		assert.ok(listed.status === "ready");
		assert.equal(listed.label, "Untitled");
	});

	test("a blank canvas is a project once edited, with no photo", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createBlankProject(canvas);
		assert.deepEqual(document.layers, []);
		await harness.projects.closeProject(id, addText(document, "CAPTION"));
		assert.equal(harness.images.size, 0);
		const [listed] = await harness.projects.listProjects();
		assert.ok(listed.status === "ready");
		assert.equal(listed.label, "CAPTION");

		const reopened = await harness.projects.openProject(id);
		assert.equal(reopened?.layers.length, 1);
		assert.equal(reopened?.background, "#FFFFFF");
	});

	test("closing a blank canvas that was never edited removes it", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createBlankProject(canvas);
		await harness.projects.closeProject(id, document);
		assert.equal(harness.files.size, 0);
		assert.deepEqual(await harness.projects.listProjects(), []);
	});

	test("a deleted photo's file goes once the project closes", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		const withoutPhoto = addText({ ...document, layers: [] }, "CAPTION");
		harness.projects.queueAutosave(id, withoutPhoto);
		harness.projects.flushAutosave();
		await tick();
		assert.ok(
			harness.images.get(id)?.has(PHOTO_FILE),
			"undo can bring it back",
		);

		await harness.projects.closeProject(id, withoutPhoto);
		assert.equal(harness.images.has(id), false);
		const reopened = await harness.projects.openProject(id);
		assert.equal(reopened?.layers.length, 1);
	});

	test("a transparent photo is kept as a PNG, not in the photo's file", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject({
			...photo,
			opaque: false,
		});
		assert.equal(imageLayers(document)[0].opaque, false);
		await harness.projects.closeProject(id, addText(document, "CAPTION"));

		const [saved] = imageLayers(savedProject(harness, id).document);
		assert.notEqual(saved.uri, PHOTO_FILE);
		assert.match(saved.uri, /\.png$/);
		assert.deepEqual([...(harness.images.get(id) ?? [])], [saved.uri]);
		const [reopened] = imageLayers(await harness.projects.openProject(id));
		assert.equal(reopened.opaque, false);
	});

	test("opening a project that no longer exists fails", async () => {
		const harness = createHarness();
		await assert.rejects(
			harness.projects.openProject("missing"),
			/no longer exists/,
		);
	});
});

describe("added photos", () => {
	test("each is saved as a file of its own, and reopens", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		const url = await projects.addImage(id, "picked-2", true);
		await projects.closeProject(id, addPhoto(document, url));

		const files = imageLayers(savedProject(harness, id).document).map(
			(layer) => layer.uri,
		);
		assert.equal(files[0], PHOTO_FILE);
		assert.notEqual(files[1], PHOTO_FILE);
		assert.ok(isImageFile(files[1]), files[1]);
		assert.deepEqual([...(harness.images.get(id) ?? [])], files);

		const reopened = await projects.openProject(id);
		assert.deepEqual(
			imageLayers(reopened).map((layer) => layer.uri),
			files.map((file) => `blob:${id}/${file}`),
		);
	});

	test("a transparent one is saved as a PNG, and reopens as one", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createBlankProject(canvas);
		const url = await projects.addImage(id, "picked", false);
		await projects.closeProject(id, {
			...document,
			layers: [createImageLayer(document, url, 400, 300, false)],
		});

		const [saved] = imageLayers(savedProject(harness, id).document);
		assert.match(saved.uri, /\.png$/);
		assert.ok(isImageFile(saved.uri), saved.uri);
		const [reopened] = imageLayers(await projects.openProject(id));
		assert.equal(reopened.opaque, false);
	});

	test("a blank canvas can hold several", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createBlankProject(canvas);
		const first = await projects.addImage(id, "picked-1", true);
		const second = await projects.addImage(id, "picked-2", true);
		assert.notEqual(first, second);
		await projects.closeProject(
			id,
			addPhoto(addPhoto(document, first), second),
		);
		assert.equal(harness.images.get(id)?.size, 2);
		const reopened = await projects.openProject(id);
		assert.equal(imageLayers(reopened).length, 2);
	});

	test("a file stays while any layer uses it, until the project closes", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createBlankProject(canvas);
		const url = await projects.addImage(id, "picked", true);
		// A duplicate shares its original's file.
		const copies = addPhoto(addPhoto(document, url), url);
		await projects.closeProject(id, {
			...copies,
			layers: copies.layers.slice(1),
		});
		assert.equal(harness.images.get(id)?.size, 1);

		const reopened = await projects.openProject(id);
		assert.ok(reopened);
		const withoutPhoto = addText({ ...reopened, layers: [] }, "CAPTION");
		projects.queueAutosave(id, withoutPhoto);
		projects.flushAutosave();
		await tick();
		assert.equal(harness.images.get(id)?.size, 1, "undo can bring it back");

		await projects.closeProject(id, withoutPhoto);
		assert.equal(harness.images.has(id), false);
	});

	test("a mask is kept with the project while its layer uses it", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		const mask = await projects.addImage(id, "mask", false);
		const [layer] = imageLayers(document);
		const cut = { ...document, layers: [withMask(layer, mask)] };
		await projects.closeProject(id, cut);

		const [saved] = imageLayers(savedProject(harness, id).document);
		assert.ok(saved.mask && isImageFile(saved.mask), saved.mask);
		assert.equal(harness.images.get(id)?.size, 2);
		const [reopened] = imageLayers(await projects.openProject(id));
		assert.equal(reopened.mask, `blob:${id}/${saved.mask}`);

		// Taken back off, the mask's file goes once the project closes.
		await projects.closeProject(id, {
			...cut,
			layers: [withMask(reopened, null)],
		});
		assert.deepEqual([...(harness.images.get(id) ?? [])], [PHOTO_FILE]);
	});

	test("closing removes files an earlier session left behind", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		harness.images.get(id)?.add("image-leftover.jpg");
		const document = await harness.projects.openProject(id);
		assert.ok(document);
		await harness.projects.closeProject(id, document);
		assert.deepEqual([...(harness.images.get(id) ?? [])], [PHOTO_FILE]);
	});

	test("closing frees every image's URL", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		const url = await projects.addImage(id, "picked", true);
		await projects.closeProject(id, addPhoto(document, url));
		assert.deepEqual(
			harness.released.toSorted(),
			[`blob:${id}/${PHOTO_FILE}`, url].toSorted(),
		);
	});

	test("opening fails when an image is missing, and frees the others", async () => {
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createProject(photo);
		const url = await projects.addImage(id, "picked", true);
		await projects.closeProject(id, addPhoto(document, url));
		harness.released.length = 0;
		harness.images.get(id)?.delete(url.slice(`blob:${id}/`.length));

		await assert.rejects(projects.openProject(id), /Missing image/);
		assert.deepEqual(harness.released, [`blob:${id}/${PHOTO_FILE}`]);
	});

	test("a photo from outside the project can't be saved", async (t) => {
		t.mock.method(console, "warn", () => {});
		const harness = createHarness();
		const { projects } = harness;
		const { id, document } = await projects.createBlankProject(canvas);
		projects.queueAutosave(id, addPhoto(document, "file:///elsewhere.jpg"));
		projects.flushAutosave();
		await tick();
		assert.equal(harness.files.size, 0);
		assert.equal(
			projects.getAutosaveError(),
			"Your latest edits couldn't be saved.",
		);
	});

	test("adding to a project that isn't open fails", async () => {
		const harness = createHarness();
		const { projects } = harness;
		await assert.rejects(
			projects.addImage("missing", "picked", true),
			/isn't open/,
		);
		const { id, document } = await projects.createBlankProject(canvas);
		await projects.closeProject(id, document);
		await assert.rejects(projects.addImage(id, "picked", true), /isn't open/);
	});

	test("a project naming image files this version doesn't write is unavailable", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const saved = savedProject(harness, id);
		const [photoLayer] = imageLayers(saved.document);
		const sticker = { ...photoLayer, id: "sticker", uri: "stickers/cat.png" };
		harness.files.set(
			id,
			JSON.stringify({
				...saved,
				document: {
					...saved.document,
					layers: [...saved.document.layers, sticker],
				},
			}),
		);
		assert.deepEqual(await harness.projects.listProjects(), [
			{ id, status: "unavailable" },
		]);
		assert.equal(await harness.projects.openProject(id), null);
	});
});

describe("thumbnails", () => {
	const render =
		(url: string, drawn: EditorDocument[] = []) =>
		async (document: EditorDocument) => {
			drawn.push(document);
			return url;
		};

	test("closing renders the saved edits, and the list shows them", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		const edited = addText(document, "CAPTION");
		const drawn: EditorDocument[] = [];
		await harness.projects.closeProject(
			id,
			edited,
			render("data:image/a", drawn),
		);

		assert.deepEqual(drawn, [edited]);
		const saved = savedProject(harness, id);
		assert.deepEqual(saved.thumbnail, {
			url: "data:image/a",
			updatedAt: saved.updatedAt,
		});
		const [listed] = await harness.projects.listProjects();
		assert.ok(listed.status === "ready");
		assert.equal(listed.thumbnail, "data:image/a");
	});

	test("an up-to-date thumbnail isn't rendered again", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "CAPTION"),
			render("data:image/a"),
		);
		const reopened = await harness.projects.openProject(id);
		assert.ok(reopened);
		const drawn: EditorDocument[] = [];
		await harness.projects.closeProject(
			id,
			reopened,
			render("data:image/b", drawn),
		);
		assert.equal(drawn.length, 0);
	});

	test("saves keep the old thumbnail until closing replaces it", async (t) => {
		let now = 0;
		t.mock.method(Date, "now", () => (now += 1000));
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "FIRST"),
			render("data:image/a"),
		);
		const reopened = await harness.projects.openProject(id);
		assert.ok(reopened);
		const edited = addText(reopened, "SECOND");
		harness.projects.queueAutosave(id, edited);
		harness.projects.flushAutosave();
		await tick();
		const autosaved = savedProject(harness, id);
		assert.equal(autosaved.thumbnail?.url, "data:image/a");
		assert.notEqual(autosaved.thumbnail?.updatedAt, autosaved.updatedAt);

		await harness.projects.closeProject(id, edited, render("data:image/b"));
		const closed = savedProject(harness, id);
		assert.deepEqual(closed.thumbnail, {
			url: "data:image/b",
			updatedAt: closed.updatedAt,
		});
	});

	test("a thumbnail that fails to render doesn't stop closing", async (t) => {
		t.mock.method(console, "warn", () => {});
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "CAPTION"),
			async () => {
				throw new Error("Couldn't draw");
			},
		);
		const [listed] = await harness.projects.listProjects();
		assert.ok(listed.status === "ready");
		assert.equal(listed.label, "CAPTION");
		assert.equal(listed.thumbnail, null);
	});
});

describe("thumbnails after a session that ended without closing", () => {
	const render =
		(url: string, drawn: EditorDocument[] = []) =>
		async (document: EditorDocument) => {
			drawn.push(document);
			return url;
		};

	// A project whose latest edit was autosaved, in a session that then ended.
	async function autosaveAndRestart(
		harness: ReturnType<typeof createHarness>,
		id: string,
		document: EditorDocument,
	) {
		harness.projects.queueAutosave(id, document);
		harness.projects.flushAutosave();
		await tick();
		harness.restart();
	}

	async function listedProject(harness: ReturnType<typeof createHarness>) {
		const [listed] = await harness.projects.listProjects();
		assert.ok(listed.status === "ready");
		return listed;
	}

	test("a missing one is listed as outdated, then rendered and kept", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await autosaveAndRestart(harness, id, addText(document, "CAPTION"));
		const before = savedProject(harness, id);
		const listed = await listedProject(harness);
		assert.equal(listed.thumbnail, null);
		assert.equal(listed.thumbnailOutdated, true);

		const drawn: EditorDocument[] = [];
		assert.equal(
			await harness.projects.updateThumbnail(id, render("data:image/a", drawn)),
			"data:image/a",
		);
		const photoUrl = `blob:${id}/${PHOTO_FILE}`;
		assert.deepEqual(
			imageLayers(drawn[0]).map((layer) => layer.uri),
			[photoUrl],
		);
		assert.ok(harness.released.includes(photoUrl));
		const after = savedProject(harness, id);
		assert.deepEqual(after, {
			...before,
			thumbnail: { url: "data:image/a", updatedAt: before.updatedAt },
		});
		const updated = await listedProject(harness);
		assert.equal(updated.thumbnail, "data:image/a");
		assert.equal(updated.thumbnailOutdated, false);
	});

	test("an older one is replaced", async (t) => {
		let now = 0;
		t.mock.method(Date, "now", () => (now += 1000));
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "FIRST"),
			render("data:image/a"),
		);
		const reopened = await harness.projects.openProject(id);
		assert.ok(reopened);
		await autosaveAndRestart(harness, id, addText(reopened, "SECOND"));
		const listed = await listedProject(harness);
		assert.equal(listed.thumbnail, "data:image/a");
		assert.equal(listed.thumbnailOutdated, true);

		await harness.projects.updateThumbnail(id, render("data:image/b"));
		const saved = savedProject(harness, id);
		assert.deepEqual(saved.thumbnail, {
			url: "data:image/b",
			updatedAt: saved.updatedAt,
		});
	});

	test("an up-to-date one isn't rendered again", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "CAPTION"),
			render("data:image/a"),
		);
		const writes = harness.writes;
		const drawn: EditorDocument[] = [];
		assert.equal(
			await harness.projects.updateThumbnail(id, render("data:image/b", drawn)),
			null,
		);
		assert.equal(drawn.length, 0);
		assert.equal(harness.writes, writes);
	});

	test("a project open here or in another tab is left alone", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await autosaveAndRestart(harness, id, addText(document, "CAPTION"));
		const before = harness.files.get(id);

		harness.openElsewhere.add(id);
		assert.equal(
			await harness.projects.updateThumbnail(id, render("data:image/a")),
			null,
		);
		harness.openElsewhere.delete(id);

		assert.ok(await harness.projects.openProject(id));
		const drawn: EditorDocument[] = [];
		assert.equal(
			await harness.projects.updateThumbnail(id, render("data:image/a", drawn)),
			null,
		);
		assert.equal(drawn.length, 0);
		assert.equal(harness.files.get(id), before);
	});

	test("a project saved again while rendering keeps that save", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await autosaveAndRestart(harness, id, addText(document, "CAPTION"));
		const saved = savedProject(harness, id);
		const newer = JSON.stringify({ ...saved, updatedAt: saved.updatedAt + 1 });

		const thumbnail = await harness.projects.updateThumbnail(id, async () => {
			harness.files.set(id, newer);
			return "data:image/a";
		});
		assert.equal(thumbnail, null);
		assert.equal(harness.files.get(id), newer);
	});

	test("a failure is logged, frees the images, and changes nothing", async (t) => {
		const warn = t.mock.method(console, "warn", () => {});
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await autosaveAndRestart(harness, id, addText(document, "CAPTION"));
		const before = harness.files.get(id);

		const thumbnail = await harness.projects.updateThumbnail(id, async () => {
			throw new Error("Couldn't draw");
		});
		assert.equal(thumbnail, null);
		assert.equal(warn.mock.callCount(), 1);
		assert.ok(harness.released.includes(`blob:${id}/${PHOTO_FILE}`));
		assert.equal(harness.files.get(id), before);
	});
});

describe("listing and deleting", () => {
	test("listing removes never-saved projects and keeps unreadable ones", async () => {
		const harness = createHarness();
		harness.images.set("abandoned", new Set([PHOTO_FILE, "image-a.jpg"]));
		const newer: Partial<SavedProject> = { version: PROJECT_VERSION + 1 };
		harness.files.set("newer", JSON.stringify(newer));
		harness.images.set("newer", new Set([PHOTO_FILE]));
		assert.deepEqual(await harness.projects.listProjects(), [
			{ id: "newer", status: "unavailable" },
		]);
		assert.equal(harness.images.has("abandoned"), false);
	});

	test("deleting removes a saved project", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		await harness.projects.deleteProject(id);
		assert.equal(harness.files.has(id), false);
		assert.deepEqual(await harness.projects.listProjects(), []);
	});
});

describe("renaming and duplicating", () => {
	async function listed(harness: ReturnType<typeof createHarness>) {
		return (await harness.projects.listProjects()).map((project) =>
			project.status === "ready" ? project.label : project.status,
		);
	}

	test("a renamed project is listed by its name, in its place", async (t) => {
		let now = 0;
		t.mock.method(Date, "now", () => (now += 1000));
		const harness = createHarness();
		const first = await createSavedProject(harness);
		await createSavedProject(harness);
		const { updatedAt } = savedProject(harness, first);
		await harness.projects.renameProject(first, "  Trip\n  to   Rome ");
		assert.equal(savedProject(harness, first).name, "Trip to Rome");
		assert.equal(savedProject(harness, first).updatedAt, updatedAt);
		assert.deepEqual(await listed(harness), ["CAPTION", "Trip to Rome"]);
	});

	test("a blank name lists it by its text again", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		await harness.projects.renameProject(id, "Named");
		await harness.projects.renameProject(id, "   ");
		assert.equal(savedProject(harness, id).name, undefined);
		assert.deepEqual(await listed(harness), ["CAPTION"]);
	});

	test("a name outlasts reopening, autosaving, and closing", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		await harness.projects.renameProject(id, "Keeper");
		const reopened = await harness.projects.openProject(id);
		assert.ok(reopened);
		const edited = addText(reopened, "MORE");
		harness.projects.queueAutosave(id, edited);
		harness.projects.flushAutosave();
		await tick();
		assert.equal(savedProject(harness, id).name, "Keeper");
		await harness.projects.closeProject(id, edited, async () => "data:image/a");
		assert.equal(savedProject(harness, id).name, "Keeper");
		assert.equal(savedProject(harness, id).thumbnail?.url, "data:image/a");
	});

	test("an open project gives its name, and an unnamed one none", async () => {
		const harness = createHarness();
		const named = await createSavedProject(harness);
		const unnamed = await createSavedProject(harness);
		await harness.projects.renameProject(named, "Keeper");
		assert.equal(harness.projects.openProjectName(named), null);
		await harness.projects.openProject(named);
		await harness.projects.openProject(unnamed);
		assert.equal(harness.projects.openProjectName(named), "Keeper");
		assert.equal(harness.projects.openProjectName(unnamed), null);
	});

	test("a copy has the document and the images it uses, on top", async (t) => {
		let now = 0;
		t.mock.method(Date, "now", () => (now += 1000));
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.closeProject(
			id,
			addText(document, "CAPTION"),
			async () => "data:image/a",
		);
		await createSavedProject(harness);
		// Left behind by an earlier session; no layer uses it.
		harness.images.get(id)?.add("image-old.jpg");

		await harness.projects.duplicateProject(id, "CAPTION copy");
		assert.deepEqual(await listed(harness), [
			"CAPTION copy",
			"CAPTION",
			"CAPTION",
		]);
		const [copy] = await harness.projects.listProjects();
		assert.notEqual(copy.id, id);
		const original = savedProject(harness, id);
		const copied = savedProject(harness, copy.id);
		assert.deepEqual(copied.document, original.document);
		assert.deepEqual([...(harness.images.get(copy.id) ?? [])], [PHOTO_FILE]);
		// Its thumbnail shows it as it is, so closing it won't draw another.
		assert.deepEqual(copied.thumbnail, {
			url: "data:image/a",
			updatedAt: copied.updatedAt,
		});
		const reopened = await harness.projects.openProject(copy.id);
		assert.deepEqual(
			imageLayers(reopened)[0].uri,
			`blob:${copy.id}/${PHOTO_FILE}`,
		);
	});

	test("a copy of an out-of-date thumbnail is still out of date", async (t) => {
		let now = 0;
		t.mock.method(Date, "now", () => (now += 1000));
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const saved = savedProject(harness, id);
		harness.files.set(
			id,
			JSON.stringify({
				...saved,
				thumbnail: { url: "data:image/a", updatedAt: saved.updatedAt - 1 },
			}),
		);
		await harness.projects.duplicateProject(id, "Copy");
		const [copy] = await harness.projects.listProjects();
		const copied = savedProject(harness, copy.id);
		assert.notEqual(copied.thumbnail?.updatedAt, copied.updatedAt);
	});

	test("a copy that fails partway leaves nothing behind", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		const url = await harness.projects.addImage(id, "added", true);
		await harness.projects.closeProject(id, addPhoto(document, url));
		let copies = 0;
		harness.copyImage = async (_fromId, file, toId) => {
			if (++copies > 1) throw new Error("Disk full");
			harness.images.set(toId, new Set([file]));
		};
		await assert.rejects(harness.projects.duplicateProject(id, "Copy"), {
			message: "Disk full",
		});
		assert.deepEqual([...harness.images.keys()], [id]);
		assert.deepEqual([...harness.files.keys()], [id]);
	});

	test("a project that's open, here or in another tab, is left alone", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const before = harness.files.get(id);
		harness.openElsewhere.add(id);
		await assert.rejects(harness.projects.renameProject(id, "Name"));
		await assert.rejects(harness.projects.duplicateProject(id, "Copy"));
		harness.openElsewhere.delete(id);

		assert.ok(await harness.projects.openProject(id));
		await assert.rejects(harness.projects.renameProject(id, "Name"));
		assert.equal(harness.files.get(id), before);
		assert.equal(harness.files.size, 1);
	});

	test("a project this version can't open can't be renamed or copied", async () => {
		const harness = createHarness();
		const newer = JSON.stringify({ version: PROJECT_VERSION + 1 });
		harness.files.set("newer", newer);
		await assert.rejects(harness.projects.renameProject("newer", "Name"));
		await assert.rejects(harness.projects.duplicateProject("newer", "Copy"));
		assert.equal(harness.files.get("newer"), newer);
		assert.equal(harness.files.size, 1);
	});
});
