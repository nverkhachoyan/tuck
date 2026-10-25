import { createProjectLifecycle } from "./projectLifecycle";
import storage from "./projectStorage";

/** The app's one project lifecycle, shared by every screen. */
export const projects = createProjectLifecycle(storage);

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
	listProjects,
	updateThumbnail,
} = projects;
