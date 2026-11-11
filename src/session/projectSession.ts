// Storage and the editor's open document are passed in so Node's test runner
// can load this. `appSession.ts` creates the app's instance.
import {
	createBlankDocument,
	createDocumentFromImage,
	type EditorDocument,
} from "../editor/core.ts";
import {
	type createOpenProjects,
	NEWER_VERSION_MESSAGE,
} from "../projects/openProjects.ts";
import { projectLabel } from "../projects/projectFile.ts";
import type { createProjectLibrary } from "../projects/projectLibrary.ts";
import { UNSAVED_PROJECT } from "../projects/projectRoute.ts";

export const UNSAVED_REOPEN_MESSAGE =
	"This photo couldn't be saved, so it can't be reopened.";

export type SessionEditor = {
	getOpenDocument(): { document: EditorDocument | null; key: string | null };
	openDocument(document: EditorDocument, key: string | null): void;
	closeDocument(): void;
};

export type SessionPhoto = {
	uri: string;
	width: number;
	height: number;
	opaque: boolean;
	preview?: string;
};

export type SessionCanvas = {
	width: number;
	height: number;
	background: string | null;
};

export type SessionProjects = Pick<
	ReturnType<typeof createOpenProjects>,
	| "createProject"
	| "createBlankProject"
	| "openProject"
	| "closeProject"
	| "addImage"
	| "openProjectName"
	| "openProjectCreatedAt"
> &
	Pick<
		ReturnType<typeof createProjectLibrary>,
		"copyOpenProject" | "updateThumbnail"
	>;

export type ProjectSessionEnv = {
	projects: SessionProjects;
	editor: SessionEditor;
	renderThumbnail?: (
		document: EditorDocument,
		previewUri?: (uri: string) => string | null,
	) => Promise<string>;
	getPreviewUri?: (projectId: string, uri: string) => string | null;
	deleteTemporaryFile?: (uri: string) => void;
};

export function createProjectSession({
	projects,
	editor,
	renderThumbnail,
	getPreviewUri,
	deleteTemporaryFile,
}: ProjectSessionEnv) {
	function thumbnailFor(projectId: string) {
		if (!renderThumbnail) return undefined;
		return (document: EditorDocument) =>
			renderThumbnail(
				document,
				getPreviewUri ? (uri) => getPreviewUri(projectId, uri) : undefined,
			);
	}

	function hasOpenSession(): boolean {
		return editor.getOpenDocument().document !== null;
	}

	function hasSavedSession(): boolean {
		const { document, key } = editor.getOpenDocument();
		return document !== null && key !== null;
	}

	/**
	 * Starts a session from a picked photo. Without storage, the photo can
	 * still be edited, just not kept. Returns null when an unclosed session is
	 * still in the editor.
	 */
	async function startFromPhoto(
		photo: SessionPhoto,
	): Promise<{ id: string | null; document: EditorDocument } | null> {
		if (editor.getOpenDocument().document) return null;
		const opened = await projects
			.createProject(photo)
			.catch((error: unknown) => {
				console.warn("Couldn't save the photo as a project", error);
				const { uri, width, height, opaque, preview } = photo;
				if (preview) deleteTemporaryFile?.(preview);
				return {
					id: null,
					document: createDocumentFromImage(uri, width, height, opaque),
				};
			});
		editor.openDocument(opened.document, opened.id);
		return opened;
	}

	/**
	 * Starts a session from a blank canvas. Without storage, the canvas can
	 * still be edited, just not kept. Returns null when an unclosed session is
	 * still in the editor.
	 */
	async function startBlank(
		canvas: SessionCanvas,
	): Promise<{ id: string | null; document: EditorDocument } | null> {
		if (editor.getOpenDocument().document) return null;
		const { width, height, background } = canvas;
		const opened = await projects
			.createBlankProject(canvas)
			.catch((error: unknown) => {
				console.warn("Couldn't save the canvas as a project", error);
				return {
					id: null,
					document: createBlankDocument(width, height, background),
				};
			});
		editor.openDocument(opened.document, opened.id);
		return opened;
	}

	/**
	 * Ends the current editing session: saves its last edits and refreshes its
	 * thumbnail when it has a saved project, then clears the editor's document
	 * unless another session already took its place. A failed save throws
	 * before clearing the editor, so the session stays open for a retry.
	 */
	async function end(): Promise<void> {
		const { document, key: projectId } = editor.getOpenDocument();
		if (!document) return;
		if (projectId !== null) {
			await projects.closeProject(projectId, document, thumbnailFor(projectId));
		}
		if (editor.getOpenDocument().document === document) {
			editor.closeDocument();
		}
	}

	/**
	 * Opens a saved project by id, first ending any session the editor holds.
	 * When `stillWanted` turns false while reading, or another session opens
	 * meanwhile, the project is closed again and null is returned.
	 */
	async function open(
		routeId: string,
		stillWanted?: () => boolean,
	): Promise<{ id: string; document: EditorDocument } | null> {
		if (routeId === UNSAVED_PROJECT) {
			throw new Error(UNSAVED_REOPEN_MESSAGE);
		}
		await end();
		const opened = await projects.openProject(routeId);
		if (!opened) {
			throw new Error(NEWER_VERSION_MESSAGE);
		}
		if ((stillWanted && !stillWanted()) || editor.getOpenDocument().document) {
			await projects.closeProject(routeId, opened);
			return null;
		}
		editor.openDocument(opened, routeId);
		return { id: routeId, document: opened };
	}

	/** Copies a project (even one open in another tab) and opens the copy. */
	async function openCopy(
		id: string,
	): Promise<{ id: string; document: EditorDocument } | null> {
		const copyId = await projects.copyOpenProject(id);
		return open(copyId);
	}

	/** Renders an outdated thumbnail for a closed project. */
	function updateThumbnail(id: string): Promise<string | null> {
		const render = thumbnailFor(id);
		if (!render) return Promise.resolve(null);
		return projects.updateThumbnail(id, render);
	}

	/**
	 * Moves an image into the open project, or leaves it where the picker put
	 * it when the session has no saved project.
	 */
	async function addImage(
		projectId: string | null,
		uri: string,
		opaque: boolean,
		preview?: string,
	): Promise<string> {
		if (projectId !== null) {
			return projects.addImage(projectId, uri, opaque, preview);
		}
		if (preview) deleteTemporaryFile?.(preview);
		return uri;
	}

	/** What home lists the open project as. */
	function title(projectId: string | null, document: EditorDocument): string {
		if (projectId === null) return projectLabel(document, Date.now());
		return (
			projects.openProjectName(projectId) ||
			projectLabel(
				document,
				projects.openProjectCreatedAt(projectId) ?? Date.now(),
			)
		);
	}

	return {
		hasOpenSession,
		hasSavedSession,
		startFromPhoto,
		startBlank,
		open,
		openCopy,
		end,
		updateThumbnail,
		addImage,
		title,
	};
}

export type ProjectSessionController = ReturnType<typeof createProjectSession>;
