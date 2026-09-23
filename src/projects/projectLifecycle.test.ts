/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTextLayer, type EditorDocument } from "../model/document.ts";
import {
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

// Storage in memory, with every write going through `write`.
function createHarness(
	write: Write = async (id, json, files) => {
		files.set(id, json);
	},
) {
	const files = new Map<string, string>();
	const photos = new Set<string>();
	let writes = 0;
	const remove = (id: string) => {
		files.delete(id);
		photos.delete(id);
	};
	const storage: ProjectStorage = {
		async claimProject() {
			return true;
		},
		async releaseProject() {},
		async storePhoto(id) {
			photos.add(id);
			return `blob:${id}`;
		},
		async photoUrl(id) {
			if (!photos.has(id)) throw new Error("Missing photo");
			return `blob:${id}`;
		},
		releasePhoto() {},
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
			return [...new Set([...photos, ...files.keys()])];
		},
	};
	return {
		projects: createProjectLifecycle(storage),
		files,
		photos,
		get writes() {
			return writes;
		},
	};
}

const photo = { uri: "picked", width: 400, height: 300 };

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function addText(document: EditorDocument, text: string): EditorDocument {
	return {
		...document,
		layers: [...document.layers, createTextLayer(document, text, "center")],
	};
}

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
		assert.equal(harness.photos.size, 0);
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

	test("opening a project that no longer exists fails", async () => {
		const harness = createHarness();
		await assert.rejects(
			harness.projects.openProject("missing"),
			/no longer exists/,
		);
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

describe("listing and deleting", () => {
	test("listing removes never-saved projects and keeps unreadable ones", async () => {
		const harness = createHarness();
		harness.photos.add("abandoned");
		const newer: Partial<SavedProject> = { version: PROJECT_VERSION + 1 };
		harness.files.set("newer", JSON.stringify(newer));
		harness.photos.add("newer");
		assert.deepEqual(await harness.projects.listProjects(), [
			{ id: "newer", status: "unavailable" },
		]);
		assert.equal(harness.photos.has("abandoned"), false);
	});

	test("deleting removes a saved project", async () => {
		const harness = createHarness();
		const id = await createSavedProject(harness);
		await harness.projects.deleteProject(id);
		assert.equal(harness.files.has(id), false);
		assert.deepEqual(await harness.projects.listProjects(), []);
	});
});
