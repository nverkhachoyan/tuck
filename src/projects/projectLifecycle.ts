// Storage is passed in so Node's test runner can load this. `projectService.ts`
// creates the app's instance.
import {
	createOpenProjects,
	isProjectOpenElsewhere,
	MISSING_IMAGE_MESSAGE,
	NEWER_VERSION_MESSAGE,
	PROJECT_OPEN_ELSEWHERE,
	type PrepareProjectPreviews,
	ProjectOpenElsewhereError,
	type ProjectStorage,
	type RenderThumbnail,
	type StoreProjectPreview,
} from "./openProjects.ts";
import {
	createProjectLibrary,
	type RemoveProjectPreviews,
} from "./projectLibrary.ts";

export {
	isProjectOpenElsewhere,
	MISSING_IMAGE_MESSAGE,
	NEWER_VERSION_MESSAGE,
	PROJECT_OPEN_ELSEWHERE,
	type PrepareProjectPreviews,
	ProjectOpenElsewhereError,
	type ProjectStorage,
	type RemoveProjectPreviews,
	type RenderThumbnail,
	type StoreProjectPreview,
};

export function createProjectLifecycle(
	storage: ProjectStorage,
	preparePreviews?: PrepareProjectPreviews,
	removePreviews?: RemoveProjectPreviews,
	storePreview?: StoreProjectPreview,
) {
	const { coordination, ...openProjects } = createOpenProjects(
		storage,
		preparePreviews,
		storePreview,
	);
	const library = createProjectLibrary(storage, coordination, removePreviews);
	return {
		...openProjects,
		...library,
	};
}

export type ProjectLifecycle = ReturnType<typeof createProjectLifecycle>;
