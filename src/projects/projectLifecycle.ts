// Relative `.ts` imports, and storage passed in, keep this loadable by Node's
// test runner. `projects.ts` creates the app's instance.
import {
	createDocumentFromImage,
	type EditorDocument,
	hasEdits,
} from "../model/document.ts";
import {
	mapImageUris,
	PHOTO_FILE,
	PROJECT_VERSION,
	type ProjectSummary,
	type ProjectThumbnail,
	parseSavedProject,
	projectLabel,
	type SavedProject,
} from "./projectFile.ts";

/** Where projects are kept: `projectStorage.ts`, or `.web.ts` in browsers. */
export type ProjectStorage = {
	claimProject(id: string): Promise<boolean>;
	releaseProject(id: string): Promise<void>;
	storePhoto(id: string, uri: string): Promise<string>;
	photoUrl(id: string): Promise<string>;
	releasePhoto(url: string): void;
	readProjectFile(id: string): Promise<string | null>;
	writeProjectFile(id: string, json: string): Promise<void>;
	removeProject(id: string): Promise<void>;
	removeInactiveProject(
		id: string,
		shouldRemove: (json: string | null) => boolean,
	): Promise<void>;
	listProjectIds(): Promise<string[]>;
};

type OpenProject = {
	photoUrl: string;
	createdAt: number;
	// Opened from the list, rather than started from a photo this session.
	reopened: boolean;
	// The document as last saved, so an unchanged one isn't written again
	// (and doesn't move up the list).
	savedJson: string | null;
	// The saved file's `updatedAt`, and the thumbnail it carries.
	updatedAt: number;
	thumbnail: ProjectThumbnail | null;
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
	return saved.document.layers.every(
		(layer) => layer.type !== "image" || layer.uri === PHOTO_FILE,
	);
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

	function savedDocument(id: string, document: EditorDocument) {
		const project = openProjects.get(id);
		if (!project) return null;
		return mapImageUris(document, (uri) => {
			if (uri !== project.photoUrl) {
				throw new Error(`${uri} isn't part of project ${id}`);
			}
			return PHOTO_FILE;
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
	async function createProject(photo: {
		uri: string;
		width: number;
		height: number;
	}): Promise<{ id: string; document: EditorDocument }> {
		await closing;
		const id = createProjectId();
		if (!(await storage.claimProject(id)))
			throw new Error("Project is already open");
		try {
			const photoUrl = await storage.storePhoto(id, photo.uri);
			const createdAt = Date.now();
			openProjects.set(id, {
				photoUrl,
				createdAt,
				reopened: false,
				savedJson: null,
				updatedAt: createdAt,
				thumbnail: null,
				writing: Promise.resolve(),
			});
			setAutosaveError(null);
			const document = createDocumentFromImage(
				photoUrl,
				photo.width,
				photo.height,
			);
			return { id, document };
		} catch (error) {
			await storage.removeProject(id).catch(() => {});
			await storage.releaseProject(id);
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
			if (json === null) throw new Error("This project no longer exists.");
			const saved = parseSavedProject(json);
			if (!saved || !hasKnownImageUris(saved)) return null;
			const photoUrl = await storage.photoUrl(id);
			const document = mapImageUris(saved.document, () => photoUrl);
			openProjects.set(id, {
				photoUrl,
				createdAt: saved.createdAt,
				reopened: true,
				savedJson: JSON.stringify(saved.document),
				updatedAt: saved.updatedAt,
				thumbnail: saved.thumbnail ?? null,
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
	 * Ends an editing session: saves the last changes, or removes the project
	 * if it was started this session and is still just the photo. A reopened
	 * project is kept even with every edit removed. A kept project's thumbnail
	 * is brought up to date with `renderThumbnail`, when given.
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
			} else {
				await storage.removeProject(id);
			}
			// A failed close leaves the document and photo available for a retry.
			openProjects.delete(id);
			if (pendingSave?.id === id) pendingSave = null;
			setAutosaveError(null);
			storage.releasePhoto(project.photoUrl);
			await storage.releaseProject(id);
		});
		closing = closed.catch(() => {});
		return closed;
	}

	/** Removes a saved project for good. */
	async function deleteProject(id: string): Promise<void> {
		await closing;
		if (openProjects.has(id) || !(await storage.claimProject(id))) {
			throw new Error("This project is open in another tab.");
		}
		try {
			await storage.removeProject(id);
		} finally {
			await storage.releaseProject(id);
		}
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
						label: projectLabel(saved.document),
						thumbnail: saved.thumbnail?.url ?? null,
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

	return {
		subscribeAutosave,
		getAutosaveError,
		hasUnsavedChanges,
		queueAutosave,
		flushAutosave,
		createProject,
		openProject,
		closeProject,
		deleteProject,
		listProjects,
	};
}
