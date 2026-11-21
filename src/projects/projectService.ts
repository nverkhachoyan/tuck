import { makePreview } from "../photos/photoImport";
import { createOpenProjects } from "./openProjects";
import { createProjectLibrary } from "./projectLibrary";
import storage from "./projectStorage";

const { coordination, ...openProjects } = createOpenProjects(
	storage,
	makePreview,
);
const library = createProjectLibrary(storage, coordination);

/** The app's one project lifecycle, shared by every screen. */
export const projects = {
	...openProjects,
	...library,
};

export const {
	createProject,
	createBlankProject,
	openProject,
	openProjectName,
	openProjectCreatedAt,
	addImage,
	closeProject,
} = openProjects;

export const {
	deleteProject,
	renameProject,
	duplicateProject,
	copyOpenProject,
	listProjects,
	updateThumbnail,
} = library;
