import type { EditorDocument } from "../editor/core.ts";
import {
	createProjectId,
	imageUrls,
	NEWER_VERSION_MESSAGE,
	type OpenProjectsCoordination,
	PROJECT_GONE_MESSAGE,
	ProjectOpenElsewhereError,
	type ProjectStorage,
	parseOpenableProject,
	type RenderThumbnail,
} from "./openProjects.ts";
import {
	copyName,
	imageFiles,
	mapImageUris,
	PROJECT_VERSION,
	type ProjectSummary,
	type ProjectThumbnail,
	parseSavedProject,
	projectLabel,
	projectName,
	type SavedProject,
} from "./projectFile.ts";

/** Removes cached preview textures when a project is deleted. */
export type RemoveProjectPreviews = (id: string) => Promise<unknown>;

export function createProjectLibrary(
	storage: ProjectStorage,
	open: OpenProjectsCoordination,
	removePreviews?: RemoveProjectPreviews,
) {
	/**
	 * Runs `work` on a saved project that no editor has open, here or in
	 * another tab, holding it until the work is done.
	 */
	async function withClosedProject<T>(
		id: string,
		work: () => Promise<T>,
	): Promise<T> {
		await open.waitForClosing();
		if (open.isOpen(id) || !(await storage.claimProject(id))) {
			throw new ProjectOpenElsewhereError();
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
		return savedFromJson(json);
	}

	/**
	 * The saved file as another tab may be writing it. A write replaces the
	 * file whole, so a read is the previous save or the next one. A read that
	 * doesn't parse is tried once more, in case it caught the replace.
	 */
	async function readSavedUnclaimed(id: string): Promise<SavedProject> {
		const json = await storage.readProjectFile(id);
		try {
			return savedFromJson(json);
		} catch (error) {
			if (json === null || !(error instanceof Error)) throw error;
			if (error.message !== NEWER_VERSION_MESSAGE) throw error;
			return savedFromJson(await storage.readProjectFile(id));
		}
	}

	function savedFromJson(json: string | null): SavedProject {
		if (json === null) throw new Error(PROJECT_GONE_MESSAGE);
		const saved = parseOpenableProject(json);
		if (!saved) throw new Error(NEWER_VERSION_MESSAGE);
		return saved;
	}

	function deleteProject(id: string): Promise<void> {
		return withClosedProject(id, async () => {
			await storage.removeProject(id);
			if (removePreviews) {
				await removePreviews(id);
			}
		});
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
			await writeCopy(id, saved, name);
		});
	}

	/**
	 * A new project with the last saved copy of `id`, which another tab may
	 * still hold open. It isn't claimed here: the read takes whatever whole
	 * file is saved, and the copy is claimed on its own.
	 */
	async function copyOpenProject(id: string): Promise<string> {
		const saved = await readSavedUnclaimed(id);
		const listed = await listProjects();
		const labels = listed.flatMap((project) =>
			project.status === "ready" ? [project.label] : [],
		);
		const label = saved.name ?? projectLabel(saved.document, saved.createdAt);
		return writeCopy(id, saved, copyName(label, labels));
	}

	/** `saved`, and the image files its layers use, as a new project called `name`. */
	async function writeCopy(
		fromId: string,
		saved: SavedProject,
		name: string,
	): Promise<string> {
		const copyId = createProjectId();
		if (!(await storage.claimProject(copyId))) {
			throw new Error("Couldn't start the copy.");
		}
		try {
			for (const file of imageFiles(saved.document)) {
				await storage.copyImage(fromId, file, copyId);
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
			return copyId;
		} catch (error) {
			await storage.removeProject(copyId).catch(() => {});
			throw error;
		} finally {
			await storage.releaseProject(copyId);
		}
	}

	/**
	 * Saved projects, most recently edited first. Removes projects that were
	 * never saved, from sessions that ended (or crashed) before an edit; keeps
	 * ones it can't read, such as from a newer version of the app.
	 */
	async function listProjects(): Promise<ProjectSummary[]> {
		await open.waitForClosing();
		const ids = await storage.listProjectIds();
		const projects = await Promise.all(
			ids
				.filter((id) => !open.isOpen(id))
				.map(async (id): Promise<ProjectSummary | null> => {
					const json = await storage.readProjectFile(id);
					if (json === null) {
						await storage.removeInactiveProject(
							id,
							(latest) => latest === null,
						);
						return null;
					}
					const saved = parseOpenableProject(json);
					if (!saved) return { id, status: "unavailable" };
					return {
						id,
						status: "ready",
						updatedAt: saved.updatedAt,
						label: saved.name ?? projectLabel(saved.document, saved.createdAt),
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
			await open.waitForClosing();
			if (open.isOpen(id)) return null;
			const json = await storage.readProjectFile(id);
			const saved = json === null ? null : parseOpenableProject(json);
			if (!saved) return null;
			const { updatedAt } = saved;
			if (saved.thumbnail?.updatedAt === updatedAt) return null;
			const url = await renderSaved(id, saved.document, render);
			const written = await writeClosedThumbnail(id, { url, updatedAt });
			return written ? url : null;
		} catch (error) {
			console.warn("Couldn't update the project's thumbnail", error);
			return null;
		}
	}

	/** Renders a closed project's saved document, holding its images meanwhile. */
	async function renderSaved(
		id: string,
		document: EditorDocument,
		render: RenderThumbnail,
	): Promise<string> {
		const urls = await imageUrls(storage, id, imageFiles(document));
		try {
			return await render(
				mapImageUris(document, (file) => urls.get(file) ?? file),
			);
		} finally {
			for (const url of urls.values()) storage.releaseImage(url);
		}
	}

	/**
	 * Gives a closed project `thumbnail`, if its file is still the save it was
	 * rendered from. With the other writes to closed projects, so one opening
	 * meanwhile waits for this rather than finding it claimed. False when the
	 * project is open, here or in another tab, or has changed.
	 */
	function writeClosedThumbnail(
		id: string,
		thumbnail: ProjectThumbnail,
	): Promise<boolean> {
		return open.afterClosing(async () => {
			if (open.isOpen(id) || !(await storage.claimProject(id))) {
				return false;
			}
			try {
				const latest = await storage.readProjectFile(id);
				const current = latest === null ? null : parseSavedProject(latest);
				if (!current || current.updatedAt !== thumbnail.updatedAt) return false;
				const file: SavedProject = { ...current, thumbnail };
				await storage.writeProjectFile(id, JSON.stringify(file));
				return true;
			} finally {
				await storage.releaseProject(id);
			}
		});
	}

	return {
		deleteProject,
		renameProject,
		duplicateProject,
		copyOpenProject,
		listProjects,
		updateThumbnail,
	};
}
