// Storage is passed in so Node's test runner can load this. `projects.ts`
// creates the app's instance.
import {
	createBlankDocument,
	createDocumentFromImage,
	type EditorDocument,
	hasEdits,
} from "../model/document.ts";
import {
	imageFiles,
	isImageFile,
	mapImageUris,
	newImageFile,
	PHOTO_FILE,
	PROJECT_VERSION,
	type ProjectSummary,
	type ProjectThumbnail,
	parseSavedProject,
	projectLabel,
	projectName,
	type SavedProject,
} from "./projectFile.ts";

/** Where projects are kept: `projectStorage.ts`, or `.web.ts` in browsers. */
export type ProjectStorage = {
	claimProject(id: string): Promise<boolean>;
	releaseProject(id: string): Promise<void>;
	storeImage(id: string, file: string, uri: string): Promise<string>;
	copyImage(fromId: string, file: string, toId: string): Promise<void>;
	imageUrl(id: string, file: string): Promise<string>;
	releaseImage(url: string): void;
	listImages(id: string): Promise<string[]>;
	removeImage(id: string, file: string): Promise<void>;
	readProjectFile(id: string): Promise<string | null>;
	writeProjectFile(id: string, json: string): Promise<void>;
	removeProject(id: string): Promise<void>;
	removeInactiveProject(
		id: string,
		shouldRemove: (json: string | null) => boolean,
	): Promise<void>;
	listProjectIds(): Promise<string[]>;
};

// The contract's shared messages, so both storage implementations and the
// lifecycle word them the same.
export const MISSING_IMAGE_MESSAGE = "One of this project's photos is missing.";
export const NEWER_VERSION_MESSAGE =
	"It may have been saved by a newer version of the app.";
const PROJECT_GONE_MESSAGE = "This project no longer exists.";

type OpenProject = {
	// The file behind each image URL the document may use: every file the
	// project had when opened, or has been given since. They're kept until it
	// closes, so undo can bring back a layer that used one.
	images: Map<string, string>;
	createdAt: number;
	// Opened from the list, rather than started this session.
	reopened: boolean;
	// The document as last saved, so an unchanged one isn't written again
	// (and doesn't move up the list).
	savedJson: string | null;
	// The saved file's `updatedAt`, and the thumbnail and name it carries.
	updatedAt: number;
	thumbnail: ProjectThumbnail | null;
	name: string | null;
	// Autosaves and closing writes must finish in document order.
	writing: Promise<void>;
};

/** Draws a document as a thumbnail's data URL; see `ProjectThumbnail`. */
export type RenderThumbnail = (document: EditorDocument) => Promise<string>;

const AUTOSAVE_DELAY_MS = 500;

function createProjectId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasKnownImageUris(saved: SavedProject): boolean {
	return [...imageFiles(saved.document)].every(isImageFile);
}

export function createProjectLifecycle(storage: ProjectStorage) {
	const openProjects = new Map<string, OpenProject>();

	// Closing a project saves or removes it; everything else waits for that, so
	// a project reopened right away is read as it was just saved.
	let closing: Promise<unknown> = Promise.resolve();

	let latestSaveRevision = 0;
	let pendingSave: {
		id: string;
		document: EditorDocument;
		revision: number;
	} | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let autosaveError: string | null = null;
	const autosaveListeners = new Set<() => void>();

	function setAutosaveError(error: string | null) {
		if (autosaveError === error) return;
		autosaveError = error;
		for (const listener of autosaveListeners) listener();
	}

	function subscribeAutosave(listener: () => void) {
		autosaveListeners.add(listener);
		return () => autosaveListeners.delete(listener);
	}

	function getAutosaveError() {
		return autosaveError;
	}

	/**
	 * The name an open project was given, if any. It can't be renamed while
	 * it's open, so this holds for the session.
	 */
	function openProjectName(id: string): string | null {
		return openProjects.get(id)?.name ?? null;
	}

	function savedDocument(id: string, document: EditorDocument) {
		const project = openProjects.get(id);
		if (!project) return null;
		return mapImageUris(document, (uri) => {
			const file = project.images.get(uri);
			if (file === undefined) {
				throw new Error(`${uri} isn't part of project ${id}`);
			}
			return file;
		});
	}

	function hasUnsavedChanges(id: string, document: EditorDocument) {
		const project = openProjects.get(id);
		return (
			!!project &&
			(hasEdits(document) || project.savedJson !== null) &&
			JSON.stringify(savedDocument(id, document)) !== project.savedJson
		);
	}

	function queueAutosave(id: string, document: EditorDocument) {
		pendingSave = { id, document, revision: ++latestSaveRevision };
		clearTimeout(saveTimer);
		saveTimer = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS);
	}

	function flushAutosave() {
		clearTimeout(saveTimer);
		const pending = pendingSave;
		pendingSave = null;
		if (!pending) return;
		saveProject(pending.id, pending.document)
			.then(() => {
				if (!pendingSave && pending.revision === latestSaveRevision) {
					setAutosaveError(null);
				}
			})
			.catch((error: unknown) => {
				if (!openProjects.has(pending.id)) return;
				// A newer edit may already be writing, with no timer left to find.
				if (pending.revision === latestSaveRevision && !pendingSave) {
					pendingSave = pending;
				}
				console.warn("Autosave failed", error);
				setAutosaveError("Your latest edits couldn't be saved.");
			});
	}

	/** Starts a project from a picked photo, which moves into it. */
	function createProject(photo: {
		uri: string;
		width: number;
		height: number;
		opaque: boolean;
	}): Promise<{ id: string; document: EditorDocument }> {
		const { uri, width, height, opaque } = photo;
		return startProject(async (id) => {
			// `PHOTO_FILE` is a JPEG, so a PNG gets a name of its own.
			const file = opaque ? PHOTO_FILE : newImageFile(opaque);
			const url = await storage.storeImage(id, file, uri);
			return {
				images: new Map([[url, file]]),
				document: createDocumentFromImage(url, width, height, opaque),
			};
		});
	}

	function createBlankProject(canvas: {
		width: number;
		height: number;
		background: string | null;
	}): Promise<{ id: string; document: EditorDocument }> {
		const { width, height, background } = canvas;
		return startProject(async () => ({
			images: new Map(),
			document: createBlankDocument(width, height, background),
		}));
	}

	async function startProject(
		start: (
			id: string,
		) => Promise<{ images: Map<string, string>; document: EditorDocument }>,
	): Promise<{ id: string; document: EditorDocument }> {
		await closing;
		const id = createProjectId();
		if (!(await storage.claimProject(id)))
			throw new Error("Project is already open");
		try {
			const { images, document } = await start(id);
			const createdAt = Date.now();
			openProjects.set(id, {
				images,
				createdAt,
				reopened: false,
				savedJson: null,
				updatedAt: createdAt,
				thumbnail: null,
				name: null,
				writing: Promise.resolve(),
			});
			setAutosaveError(null);
			return { id, document };
		} catch (error) {
			await storage.removeProject(id).catch(() => {});
			await storage.releaseProject(id);
			throw error;
		}
	}

	async function imageUrls(
		id: string,
		files: Set<string>,
	): Promise<Map<string, string>> {
		const urls = new Map<string, string>();
		try {
			for (const file of files) {
				urls.set(file, await storage.imageUrl(id, file));
			}
			return urls;
		} catch (error) {
			for (const url of urls.values()) storage.releaseImage(url);
			throw error;
		}
	}

	/**
	 * A saved project's document, or null if this version can't open it.
	 * Throws if the project no longer exists.
	 */
	async function openProject(id: string): Promise<EditorDocument | null> {
		await closing;
		if (!(await storage.claimProject(id))) {
			throw new Error("This project is already open in another tab.");
		}
		let opened = false;
		try {
			const json = await storage.readProjectFile(id);
			if (json === null) throw new Error(PROJECT_GONE_MESSAGE);
			const saved = parseSavedProject(json);
			if (!saved || !hasKnownImageUris(saved)) return null;
			const urls = await imageUrls(id, imageFiles(saved.document));
			const document = mapImageUris(
				saved.document,
				(file) => urls.get(file) ?? file,
			);
			openProjects.set(id, {
				images: new Map([...urls].map(([file, url]) => [url, file])),
				createdAt: saved.createdAt,
				reopened: true,
				savedJson: JSON.stringify(saved.document),
				updatedAt: saved.updatedAt,
				thumbnail: saved.thumbnail ?? null,
				name: saved.name ?? null,
				writing: Promise.resolve(),
			});
			setAutosaveError(null);
			opened = true;
			return document;
		} finally {
			if (!opened) await storage.releaseProject(id);
		}
	}

	/**
	 * Saves an open project's document in order. A return to the original photo
	 * must replace an earlier saved edit, even while the editor remains open.
	 */
	async function saveProject(
		id: string,
		document: EditorDocument,
	): Promise<void> {
		const project = openProjects.get(id);
		if (!project) return;
		const saved = savedDocument(id, document);
		if (!saved) return;
		const savedJson = JSON.stringify(saved);
		const written = project.writing.then(async () => {
			if (savedJson === project.savedJson) return;
			// A newly picked photo is not a project until an edit has existed.
			if (!hasEdits(document) && project.savedJson === null) return;
			const file: SavedProject = {
				version: PROJECT_VERSION,
				createdAt: project.createdAt,
				updatedAt: Date.now(),
				document: saved,
				thumbnail: project.thumbnail ?? undefined,
				name: project.name ?? undefined,
			};
			await storage.writeProjectFile(id, JSON.stringify(file));
			project.savedJson = savedJson;
			project.updatedAt = file.updatedAt;
		});
		// Keep the queue usable after an autosave error; return the error to callers.
		project.writing = written.catch(() => {});
		return written;
	}

	/**
	 * Renders a thumbnail of the saved document when the one it carries is
	 * missing or older. It only decorates the list, so a failure is logged.
	 */
	async function refreshThumbnail(
		id: string,
		document: EditorDocument,
		render: RenderThumbnail,
	) {
		const project = openProjects.get(id);
		if (!project || project.savedJson === null) return;
		const { updatedAt } = project;
		if (project.thumbnail?.updatedAt === updatedAt) return;
		try {
			const thumbnail = { url: await render(document), updatedAt };
			const written = project.writing.then(async () => {
				if (project.savedJson === null || project.updatedAt !== updatedAt) {
					return;
				}
				const file: SavedProject = {
					version: PROJECT_VERSION,
					createdAt: project.createdAt,
					updatedAt,
					document: JSON.parse(project.savedJson),
					thumbnail,
					name: project.name ?? undefined,
				};
				await storage.writeProjectFile(id, JSON.stringify(file));
				project.thumbnail = thumbnail;
			});
			project.writing = written.catch(() => {});
			await written;
		} catch (error) {
			console.warn("Couldn't update the project's thumbnail", error);
		}
	}

	/**
	 * Moves a picked photo into an open project as a file of its own, and
	 * returns its URL there, for a new image layer's `uri` or `mask`.
	 */
	async function addImage(
		id: string,
		uri: string,
		opaque: boolean,
	): Promise<string> {
		const project = openProjects.get(id);
		if (!project) throw new Error("This project isn't open.");
		const file = newImageFile(opaque);
		const url = await storage.storeImage(id, file, uri);
		// Closed meanwhile: the unused file goes when the project next closes,
		// or with the project, if it wasn't kept.
		if (openProjects.get(id) !== project) {
			storage.releaseImage(url);
			throw new Error("This project was closed.");
		}
		project.images.set(url, file);
		return url;
	}

	/**
	 * Removes a closing project's image files that no layer uses, including
	 * any a session that ended early left behind. They only take space, and a
	 * later close tries again, so a failure is logged.
	 */
	async function removeUnusedImages(id: string, document: EditorDocument) {
		try {
			const saved = savedDocument(id, document);
			if (!saved) return;
			const used = imageFiles(saved);
			for (const file of await storage.listImages(id)) {
				if (!used.has(file)) await storage.removeImage(id, file);
			}
		} catch (error) {
			console.warn("Couldn't remove unused images", error);
		}
	}

	/**
	 * Ends an editing session: saves the last changes, or removes the project
	 * if it was started this session and is still just the photo or an empty
	 * canvas. A reopened project is kept even with every edit removed. A kept
	 * project's thumbnail is brought up to date with `renderThumbnail`, when
	 * given, and image files no layer uses are removed: undo can't bring
	 * them back after closing.
	 */
	function closeProject(
		id: string,
		document: EditorDocument,
		renderThumbnail?: RenderThumbnail,
	): Promise<void> {
		if (pendingSave?.id === id) {
			clearTimeout(saveTimer);
			pendingSave = null;
		}
		const closed = closing.then(async () => {
			const project = openProjects.get(id);
			if (!project) return;
			await project.writing;
			if (hasEdits(document) || project.reopened) {
				await saveProject(id, document);
				if (renderThumbnail) {
					await refreshThumbnail(id, document, renderThumbnail);
				}
				await removeUnusedImages(id, document);
			} else {
				await storage.removeProject(id);
			}
			// A failed close leaves the document and images available for a retry.
			openProjects.delete(id);
			if (pendingSave?.id === id) pendingSave = null;
			setAutosaveError(null);
			for (const url of project.images.keys()) storage.releaseImage(url);
			await storage.releaseProject(id);
		});
		closing = closed.catch(() => {});
		return closed;
	}

	/**
	 * Runs `work` on a saved project that no editor has open, here or in
	 * another tab, holding it until the work is done.
	 */
	async function withClosedProject<T>(
		id: string,
		work: () => Promise<T>,
	): Promise<T> {
		await closing;
		if (openProjects.has(id) || !(await storage.claimProject(id))) {
			throw new Error("This project is open in another tab.");
		}
		try {
			return await work();
		} finally {
			await storage.releaseProject(id);
		}
	}

	/** A closed project's saved file, which this version can open. */
	async function readSaved(id: string): Promise<SavedProject> {
		const json = await storage.readProjectFile(id);
		if (json === null) throw new Error(PROJECT_GONE_MESSAGE);
		const saved = parseSavedProject(json);
		if (!saved || !hasKnownImageUris(saved)) {
			throw new Error(NEWER_VERSION_MESSAGE);
		}
		return saved;
	}

	function deleteProject(id: string): Promise<void> {
		return withClosedProject(id, () => storage.removeProject(id));
	}

	/**
	 * Names a saved project, or with a name that's blank (see `projectName`),
	 * lists it by its text again. It keeps its place in the list: a rename
	 * isn't an edit.
	 */
	function renameProject(id: string, text: string): Promise<void> {
		return withClosedProject(id, async () => {
			const { name: _, ...saved } = await readSaved(id);
			const name = projectName(text);
			const renamed: SavedProject = name === null ? saved : { ...saved, name };
			await storage.writeProjectFile(id, JSON.stringify(renamed));
		});
	}

	/**
	 * Copies a saved project, with the image files its layers use, as a new
	 * one called `name`, at the top of the list. Its thumbnail comes along,
	 * still as up to date as the original's was.
	 */
	function duplicateProject(id: string, name: string): Promise<void> {
		return withClosedProject(id, async () => {
			const saved = await readSaved(id);
			const copyId = createProjectId();
			if (!(await storage.claimProject(copyId))) {
				throw new Error("Couldn't start the copy.");
			}
			try {
				for (const file of imageFiles(saved.document)) {
					await storage.copyImage(id, file, copyId);
				}
				const now = Date.now();
				const { thumbnail } = saved;
				const copy: SavedProject = {
					version: PROJECT_VERSION,
					createdAt: now,
					updatedAt: now,
					document: saved.document,
					thumbnail:
						thumbnail?.updatedAt === saved.updatedAt
							? { ...thumbnail, updatedAt: now }
							: thumbnail,
					name: projectName(name) ?? undefined,
				};
				await storage.writeProjectFile(copyId, JSON.stringify(copy));
			} catch (error) {
				await storage.removeProject(copyId).catch(() => {});
				throw error;
			} finally {
				await storage.releaseProject(copyId);
			}
		});
	}

	/**
	 * Saved projects, most recently edited first. Removes projects that were
	 * never saved, from sessions that ended (or crashed) before an edit; keeps
	 * ones it can't read, such as from a newer version of the app.
	 */
	async function listProjects(): Promise<ProjectSummary[]> {
		await closing;
		const ids = await storage.listProjectIds();
		const projects = await Promise.all(
			ids
				.filter((id) => !openProjects.has(id))
				.map(async (id): Promise<ProjectSummary | null> => {
					const json = await storage.readProjectFile(id);
					if (json === null) {
						await storage.removeInactiveProject(
							id,
							(latest) => latest === null,
						);
						return null;
					}
					const saved = parseSavedProject(json);
					if (!saved || !hasKnownImageUris(saved)) {
						return { id, status: "unavailable" };
					}
					return {
						id,
						status: "ready",
						updatedAt: saved.updatedAt,
						label: saved.name ?? projectLabel(saved.document),
						thumbnail: saved.thumbnail?.url ?? null,
						thumbnailOutdated: saved.thumbnail?.updatedAt !== saved.updatedAt,
					};
				}),
		);
		return projects
			.filter((project) => project !== null)
			.sort(
				(a, b) =>
					(b.status === "ready" ? b.updatedAt : 0) -
					(a.status === "ready" ? a.updatedAt : 0),
			);
	}

	/**
	 * Renders a thumbnail for a closed project whose one is missing or older
	 * than its latest save, as when a session ended without closing, and
	 * returns it. Returns null when there's nothing to do: the project is up
	 * to date, open here or in another tab, or changed while rendering. It
	 * only decorates the list, so a failure is logged.
	 */
	async function updateThumbnail(
		id: string,
		render: RenderThumbnail,
	): Promise<string | null> {
		try {
			await closing;
			if (openProjects.has(id)) return null;
			const json = await storage.readProjectFile(id);
			const saved = json === null ? null : parseSavedProject(json);
			if (!saved || !hasKnownImageUris(saved)) return null;
			const { updatedAt } = saved;
			if (saved.thumbnail?.updatedAt === updatedAt) return null;
			const urls = await imageUrls(id, imageFiles(saved.document));
			let url: string;
			try {
				url = await render(
					mapImageUris(saved.document, (file) => urls.get(file) ?? file),
				);
			} finally {
				for (const imageUrl of urls.values()) storage.releaseImage(imageUrl);
			}
			// With the other writes to closed projects, so one opening meanwhile
			// waits for this rather than finding it claimed.
			const written = closing.then(async () => {
				if (openProjects.has(id) || !(await storage.claimProject(id))) {
					return false;
				}
				try {
					const latest = await storage.readProjectFile(id);
					const current = latest === null ? null : parseSavedProject(latest);
					if (!current || current.updatedAt !== updatedAt) return false;
					const file: SavedProject = {
						...current,
						thumbnail: { url, updatedAt },
					};
					await storage.writeProjectFile(id, JSON.stringify(file));
					return true;
				} finally {
					await storage.releaseProject(id);
				}
			});
			closing = written.catch(() => {});
			return (await written) ? url : null;
		} catch (error) {
			console.warn("Couldn't update the project's thumbnail", error);
			return null;
		}
	}

	return {
		subscribeAutosave,
		getAutosaveError,
		openProjectName,
		hasUnsavedChanges,
		queueAutosave,
		flushAutosave,
		createProject,
		createBlankProject,
		openProject,
		addImage,
		closeProject,
		deleteProject,
		renameProject,
		duplicateProject,
		listProjects,
		updateThumbnail,
	};
}
