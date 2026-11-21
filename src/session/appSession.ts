import {
	closeDocument,
	getOpenDocument,
	openDocument,
	renderThumbnail,
} from "@/editor";
import { deleteTemporaryFile } from "@/platform/temporaryFile";
import { projects } from "@/projects/projectService";
import { createProjectSession } from "./projectSession";

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
