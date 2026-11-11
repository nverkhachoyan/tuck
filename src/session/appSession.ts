import {
	closeDocument,
	getOpenDocument,
	openDocument,
	renderThumbnail,
} from "@/editor";
import { getPreviewUri } from "@/photos/previewCache";
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
	getPreviewUri,
	deleteTemporaryFile,
});

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
