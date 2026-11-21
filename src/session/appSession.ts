import type { EditorDocument } from "@/editor/core";
import {
	closeDocument,
	getOpenDocument,
	openDocument,
} from "@/editor/openDocument";
import { loadSkia } from "@/platform/skia";
import { deleteTemporaryFile } from "@/platform/temporaryFile";
import { projects } from "@/projects/projectService";
import { createProjectSession } from "./projectSession";

// Loaded dynamically once CanvasKit is ready, so Home and the other non-drawing
// pages never evaluate Skia statically.
async function renderThumbnail(
	document: EditorDocument,
	previewUri?: (uri: string) => string | null,
): Promise<string> {
	await loadSkia();
	const { renderThumbnail: render } = await import("@/editor");
	return render(document, previewUri);
}

/** The app's one project session controller, shared by every screen. */
export const appSession = createProjectSession({
	projects,
	editor: {
		getOpenDocument,
		openDocument,
		closeDocument,
	},
	renderThumbnail,
	getPreviewUri: projects.previewUri,
	deleteTemporaryFile,
});

/** The canvas preview for an open project's image URL, if it has one. */
export const previewUri = projects.previewUri;

export const {
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
} = appSession;
