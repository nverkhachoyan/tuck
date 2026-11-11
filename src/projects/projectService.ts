import {
	copyProjectPreviews,
	prepareProjectPreviews,
	removeProjectPreviews,
	storePreview,
} from "../photos/previewCache";
import { createOpenProjects } from "./openProjects";
import { createProjectLibrary } from "./projectLibrary";
import storage from "./projectStorage";

const { coordination, ...openProjects } = createOpenProjects(
	storage,
	prepareProjectPreviews,
	storePreview,
);
const library = createProjectLibrary(
	storage,
	coordination,
	removeProjectPreviews,
	copyProjectPreviews,
);

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
