import { createProjectLifecycle } from "./projectLifecycle";
import * as storage from "./projectStorage";

/** The app's one project lifecycle, shared by every screen. */
export const projects = createProjectLifecycle(storage);

export const {
	createProject,
	createBlankProject,
	openProject,
	addImage,
	closeProject,
	deleteProject,
	renameProject,
	duplicateProject,
	listProjects,
} = projects;
