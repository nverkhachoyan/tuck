/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EditorDocument } from "../../editor/core.ts";
import { isProjectOpenElsewhere } from "../openProjects.ts";
import {
	PHOTO_FILE,
	PROJECT_VERSION,
	type SavedProject,
} from "../projectFile.ts";
import {
	addPhoto,
	addText,
	createHarness,
	createSavedProject,
	imageLayers,
	photo,
	savedProject,
	tick,
} from "./testStorage.ts";

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
		assert.equal(
			harness.projects.openProjectCreatedAt(named),
			savedProject(harness, named).createdAt,
		);
		assert.equal(harness.projects.openProjectCreatedAt("missing"), null);
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
		assert.deepEqual(harness.copiedPreviews, [
			{ fromId: id, toId: copy.id, files: new Set([PHOTO_FILE]) },
		]);
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

	test("a copy whose previews can't be copied is still made", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		harness.copyPreviews = async () => {
			throw new Error("Close this app's other tabs, then try again.");
		};
		await harness.projects.duplicateProject(id, "Copy");
		const copies = (await harness.projects.listProjects()).filter(
			(listed) => listed.id !== id,
		);
		assert.equal(copies.length, 1);
		assert.deepEqual(
			savedProject(harness, copies[0].id).document,
			savedProject(harness, id).document,
		);
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

	test("a project open elsewhere can be copied without claiming it", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		const saved = harness.files.get(id);
		harness.openElsewhere.add(id);
		await assert.rejects(harness.projects.openProject(id), (error: unknown) => {
			assert.equal(isProjectOpenElsewhere(error), true);
			assert.equal(
				error instanceof Error && error.message,
				"This project is open in another tab. Close it there, then try again.",
			);
			return true;
		});

		const copyId = await harness.projects.copyOpenProject(id);
		const copy = savedProject(harness, copyId);
		assert.equal(
			JSON.stringify(copy.document),
			JSON.stringify(savedProject(harness, id).document),
		);
		assert.equal(copy.name, "CAPTION copy");
		assert.ok(harness.images.get(copyId)?.has(PHOTO_FILE));
		assert.equal(harness.files.get(id), saved);
		await assert.rejects(
			harness.projects.openProject(id),
			isProjectOpenElsewhere,
		);
	});

	test("a copy raced with a save is one whole file, the old or the new", async () => {
		let reads = 0;
		let markWaiting: () => void = () => {};
		const retryWaiting = new Promise<void>((resolve) => {
			markWaiting = resolve;
		});
		let releaseRetry: () => void = () => {};
		const retryGate = new Promise<void>((resolve) => {
			releaseRetry = resolve;
		});
		const harness = createHarness(undefined, async (id, files) => {
			reads += 1;
			if (reads === 1) return "{torn";
			if (reads === 2) {
				markWaiting();
				await retryGate;
			}
			return files.get(id) ?? null;
		});
		const id = await createSavedProject(harness);
		const older = savedProject(harness, id);
		harness.openElsewhere.add(id);
		const pending = harness.projects.copyOpenProject(id);
		await retryWaiting;
		const newerDocument = addText(older.document, "NEWER");
		harness.files.set(
			id,
			JSON.stringify({ ...older, document: newerDocument }),
		);
		releaseRetry();
		const copyId = await pending;
		const copy = savedProject(harness, copyId);
		assert.deepEqual(copy.document, newerDocument);
		assert.equal(
			copy.document.layers.filter((layer) => layer.type === "text").length,
			2,
		);
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
