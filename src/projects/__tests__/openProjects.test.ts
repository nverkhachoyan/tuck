/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createImageLayer,
	type EditorDocument,
	withMask,
} from "../../editor/core.ts";
import { formatCreatedAt } from "../formatCreatedAt.ts";
import { isImageFile, PHOTO_FILE } from "../projectFile.ts";
import {
	addPhoto,
	addText,
	canvas,
	createHarness,
	createSavedProject,
	imageLayers,
	photo,
	savedProject,
	tick,
} from "./testStorage.ts";

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
		const saved = savedProject(harness, id);
		assert.equal(listed.label, `Photo · ${formatCreatedAt(saved.createdAt)}`);
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

	test("a photo's preview is kept with it, and found while it's open", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject({
			...photo,
			preview: "picked-preview",
		});
		const [layer] = imageLayers(document);
		assert.equal(
			harness.projects.previewUri(id, layer.uri),
			`preview:${id}/${PHOTO_FILE}`,
		);
		const added = await harness.projects.addImage(
			id,
			"picked",
			true,
			"picked-preview",
		);
		const mask = await harness.projects.addImage(id, "mask", false);
		assert.equal(
			harness.projects.previewUri(id, added),
			added.replace("blob:", "preview:"),
		);
		assert.equal(harness.projects.previewUri(id, mask), null);
		await harness.projects.closeProject(id, addPhoto(document, added));
		assert.equal(harness.projects.previewUri(id, layer.uri), null);
		assert.deepEqual(
			[...(harness.previews.get(id) ?? [])].sort(),
			[PHOTO_FILE, added.slice(`blob:${id}/`.length)].sort(),
		);
	});

	test("reopening finds a kept preview, or makes one that's missing", async () => {
		const made: string[] = [];
		const harness = createHarness(undefined, undefined, async (url, size) => {
			made.push(`${url}:${size.width}x${size.height}`);
			return "made-preview";
		});
		const { id, document } = await harness.projects.createProject({
			...photo,
			preview: "picked-preview",
		});
		await harness.projects.closeProject(id, addText(document, "CAPTION"));

		const kept = await harness.projects.openProject(id);
		const url = imageLayers(kept)[0].uri;
		assert.equal(
			harness.projects.previewUri(id, url),
			`preview:${id}/${PHOTO_FILE}`,
		);
		assert.deepEqual(made, []);
		assert.ok(kept);
		await harness.projects.closeProject(id, kept);

		// Purged, or saved before previews were kept.
		harness.previews.delete(id);
		const rebuilt = await harness.projects.openProject(id);
		assert.deepEqual(made, [`${url}:400x300`]);
		assert.equal(
			harness.projects.previewUri(id, url),
			`preview:${id}/${PHOTO_FILE}`,
		);
		assert.equal(harness.previews.get(id)?.has(PHOTO_FILE), true);
		assert.ok(rebuilt);
		await harness.projects.closeProject(id, rebuilt);
	});

	test("an image too small for a preview, or one that fails, opens without", async (t) => {
		const warn = t.mock.method(console, "warn", () => {});
		let fail = false;
		const harness = createHarness(undefined, undefined, async () => {
			if (fail) throw new Error("Couldn't read the photo.");
			return null;
		});
		const id = await createSavedProject(harness);
		const small = await harness.projects.openProject(id);
		assert.ok(small);
		assert.equal(
			harness.projects.previewUri(id, imageLayers(small)[0].uri),
			null,
		);
		assert.equal(warn.mock.callCount(), 0);
		await harness.projects.closeProject(id, small);

		fail = true;
		const failed = await harness.projects.openProject(id);
		assert.ok(failed);
		assert.equal(
			harness.projects.previewUri(id, imageLayers(failed)[0].uri),
			null,
		);
		assert.equal(warn.mock.callCount(), 1);
	});

	test("a closed project holds no URLs", async () => {
		const harness = createHarness(
			undefined,
			undefined,
			async () => "made-preview",
		);
		const { id, document } = await harness.projects.createProject({
			...photo,
			preview: "picked-preview",
		});
		const added = await harness.projects.addImage(
			id,
			"picked",
			true,
			"picked-preview",
		);
		await harness.projects.closeProject(id, addPhoto(document, added));
		const reopened = await harness.projects.openProject(id);
		assert.ok(reopened);
		await harness.projects.closeProject(id, reopened);

		// Two images and their previews, twice over.
		assert.equal(harness.issued.length, 8);
		assert.deepEqual([...harness.released].sort(), [...harness.issued].sort());
	});

	test("an image no layer uses goes with its preview", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject(photo);
		await harness.projects.addImage(id, "picked", true, "picked-preview");
		assert.equal(harness.previews.get(id)?.size, 1);
		await harness.projects.closeProject(id, addText(document, "CAPTION"));
		assert.equal(harness.previews.has(id), false);
	});

	test("deleting a project leaves none of its previews", async () => {
		const harness = createHarness();
		const { id, document } = await harness.projects.createProject({
			...photo,
			preview: "preview",
		});
		await harness.projects.closeProject(id, addText(document, "TEXT"));
		assert.equal(harness.previews.has(id), true);

		await harness.projects.deleteProject(id);
		assert.equal(harness.previews.has(id), false);
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
