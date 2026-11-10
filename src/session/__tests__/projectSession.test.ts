/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTextLayer, type EditorDocument } from "../../editor/core.ts";
import { parseSavedProject } from "../../projects/projectFile.ts";
import {
	createProjectLifecycle,
	type ProjectStorage,
} from "../../projects/projectLifecycle.ts";
import { UNSAVED_PROJECT } from "../../projects/projectRoute.ts";
import {
	createProjectSession,
	type EditorSessionStore,
	UNSAVED_REOPEN_MESSAGE,
} from "../projectSession.ts";

const photo = {
	uri: "file:///picked.jpg",
	width: 400,
	height: 300,
	opaque: true,
	preview: "file:///picked-preview.jpg",
};
const canvas = { width: 1080, height: 1080, background: "#FFFFFF" };

function addText(document: EditorDocument, text: string): EditorDocument {
	return {
		...document,
		layers: [...document.layers, createTextLayer(document, text)],
	};
}

function createHarness(options?: {
	shouldFailWrite?: (id: string) => boolean;
	shouldFailClaim?: (id: string) => boolean;
	beforeOpenRead?: (id: string) => Promise<void>;
}) {
	const files = new Map<string, string>();
	const images = new Map<string, Set<string>>();
	const deletedTemps: string[] = [];
	const thumbnails: Array<{ id: string | undefined; uri: string }> = [];

	let currentSession: {
		document: EditorDocument | null;
		key: string | null;
	} = {
		document: null,
		key: null,
	};

	const editor: EditorSessionStore & {
		edit(document: EditorDocument): void;
	} = {
		getSession: () => currentSession,
		openDocument(document, key) {
			currentSession = { document, key };
		},
		closeDocument() {
			currentSession = { document: null, key: null };
		},
		edit(document) {
			currentSession = { ...currentSession, document };
		},
	};

	const storage: ProjectStorage = {
		async claimProject(id) {
			return !options?.shouldFailClaim?.(id);
		},
		async releaseProject() {},
		async storeImage(id, file) {
			images.set(id, new Set(images.get(id)).add(file));
			return `blob:${id}/${file}`;
		},
		async copyImage(fromId, file, toId) {
			if (!images.get(fromId)?.has(file)) throw new Error("Missing image");
			images.set(toId, new Set(images.get(toId)).add(file));
		},
		async imageUrl(id, file) {
			if (!images.get(id)?.has(file)) throw new Error("Missing image");
			return `blob:${id}/${file}`;
		},
		releaseImage() {},
		async listImages(id) {
			return [...(images.get(id) ?? [])];
		},
		async removeImage(id, file) {
			images.get(id)?.delete(file);
		},
		async readProjectFile(id) {
			await options?.beforeOpenRead?.(id);
			return files.get(id) ?? null;
		},
		async writeProjectFile(id, json) {
			if (options?.shouldFailWrite?.(id)) {
				throw new Error("Disk full");
			}
			files.set(id, json);
		},
		async removeProject(id) {
			files.delete(id);
			images.delete(id);
		},
		async removeInactiveProject(id, shouldRemove) {
			if (shouldRemove(files.get(id) ?? null)) {
				files.delete(id);
				images.delete(id);
			}
		},
		async listProjectIds() {
			return [...new Set([...images.keys(), ...files.keys()])];
		},
	};

	const projects = createProjectLifecycle(storage);
	const session = createProjectSession({
		projects,
		editor,
		renderThumbnail: async (doc, previewUri) => {
			const first = doc.layers[0];
			const uri =
				first?.type === "image"
					? (previewUri?.(first.uri) ?? first.uri)
					: "blank";
			thumbnails.push({ id: currentSession.key ?? undefined, uri });
			return `data:image/jpeg;base64,${uri}`;
		},
		getPreviewUri: (projectId, uri) => `preview:${projectId}:${uri}`,
		deleteTemporaryFile: (uri) => {
			deletedTemps.push(uri);
		},
	});

	return {
		files,
		images,
		deletedTemps,
		thumbnails,
		editor,
		projects,
		session,
	};
}

describe("projectSession", () => {
	test("closes an edited project with its preview-mapped thumbnail and reopens it", async () => {
		const { session, editor, files } = createHarness();
		const started = await session.startFromPhoto(photo);
		assert.ok(started?.id);
		assert.equal(session.hasOpenSession(), true);
		assert.equal(session.hasSavedSession(), true);

		editor.edit(addText(started.document, "HELLO"));
		await session.end();
		assert.equal(session.hasOpenSession(), false);

		const saved = parseSavedProject(files.get(started.id) ?? "");
		assert.ok(saved);
		assert.equal(
			saved.thumbnail?.url,
			`data:image/jpeg;base64,preview:${started.id}:blob:${started.id}/original.jpg`,
		);

		const reopened = await session.open(started.id);
		assert.ok(reopened);
		assert.equal(reopened.id, started.id);
		assert.equal(reopened.document.layers.length, 2);
		assert.equal(editor.getSession().key, started.id);
	});

	test("a link to another project while one is open saves and closes the first before opening the second", async () => {
		const { session, editor, files } = createHarness();

		const first = await session.startFromPhoto(photo);
		assert.ok(first?.id);
		editor.edit(addText(first.document, "FIRST"));
		await session.end();

		const second = await session.startBlank(canvas);
		assert.ok(second?.id);
		editor.edit(addText(second.document, "SECOND"));

		// Navigate directly to `first.id` while `second.id` is still open in the editor.
		const switched = await session.open(first.id);
		assert.ok(switched);
		assert.equal(switched.id, first.id);
		assert.equal(editor.getSession().key, first.id);

		// `second` was saved when `open(first.id)` ended it first.
		const savedSecond = parseSavedProject(files.get(second.id) ?? "");
		assert.ok(savedSecond);
		assert.equal(savedSecond.document.layers.length, 1);
	});

	test("a failed save on close keeps the session open and blocks starting another until retry succeeds", async () => {
		let failWrite = true;
		const { session, editor } = createHarness({
			shouldFailWrite: () => failWrite,
		});

		const started = await session.startFromPhoto(photo);
		assert.ok(started?.id);
		editor.edit(addText(started.document, "KEEP ME"));

		await assert.rejects(() => session.end(), /Disk full/);
		assert.equal(session.hasOpenSession(), true);
		assert.equal(editor.getSession().key, started.id);

		// Starting a photo or blank canvas while the failed session is still open is refused.
		assert.equal(await session.startFromPhoto(photo), null);
		assert.equal(await session.startBlank(canvas), null);

		failWrite = false;
		await session.end();
		assert.equal(session.hasOpenSession(), false);
	});

	test("leaving before an open finishes closes the project again without populating the editor", async () => {
		let wanted = true;
		let targetId = "";
		const { session, editor, projects } = createHarness({
			beforeOpenRead: async (id) => {
				if (id === targetId) {
					wanted = false;
				}
			},
		});

		const created = await session.startFromPhoto(photo);
		assert.ok(created?.id);
		editor.edit(addText(created.document, "SAVED"));
		await session.end();

		targetId = created.id;
		const opened = await session.open(created.id, () => wanted);
		assert.equal(opened, null);
		assert.equal(session.hasOpenSession(), false);

		// Because the abandoned open closed the project again, the library can rename it.
		await projects.renameProject(created.id, "Renamed after cancel");
		const list = await projects.listProjects();
		assert.equal(
			list[0]?.status === "ready" ? list[0].label : null,
			"Renamed after cancel",
		);
	});

	test("falls back to an unsaved session when storage cannot create a project", async (t) => {
		t.mock.method(console, "warn", () => {});
		const { session, editor, deletedTemps } = createHarness({
			shouldFailClaim: () => true,
		});

		const fromPhoto = await session.startFromPhoto(photo);
		assert.ok(fromPhoto);
		assert.equal(fromPhoto.id, null);
		assert.equal(session.hasOpenSession(), true);
		assert.equal(session.hasSavedSession(), false);
		assert.deepEqual(deletedTemps, [photo.preview]);

		await session.end();
		assert.equal(session.hasOpenSession(), false);

		const fromBlank = await session.startBlank(canvas);
		assert.ok(fromBlank);
		assert.equal(fromBlank.id, null);
		assert.equal(editor.getSession().key, null);

		await assert.rejects(
			() => session.open(UNSAVED_PROJECT),
			new RegExp(UNSAVED_REOPEN_MESSAGE),
		);
	});
});
