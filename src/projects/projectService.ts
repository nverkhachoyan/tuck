import {
	prepareProjectPreviews,
	removeProjectPreviews,
} from "../photos/previewCache";
import { createProjectLifecycle } from "./projectLifecycle";
import storage from "./projectStorage";

/** The app's one project lifecycle, shared by every screen. */
export const projects = createProjectLifecycle(
	storage,
	prepareProjectPreviews,
	removeProjectPreviews,
);

export const {
	createProject,
	createBlankProject,
	openProject,
	openProjectName,
	openProjectCreatedAt,
	addImage,
	closeProject,
	deleteProject,
	renameProject,
	duplicateProject,
	copyOpenProject,
	listProjects,
	updateThumbnail,
} = projects;
