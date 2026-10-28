import { Directory, File, Paths } from "expo-file-system";
import { MISSING_IMAGE_MESSAGE, type ProjectStorage } from "./projectLifecycle";

// `projectStorage.web.ts` implements the same API for browsers. Each project
// is a folder holding its image files, if it has any, and once it has been
// saved, its JSON.

const PROJECT = "project.json";
const PROJECT_DRAFT = "project.json.tmp";

const projectsDirectory = () => new Directory(Paths.document, "projects");
const projectDirectory = (id: string) => new Directory(projectsDirectory(), id);

// Native has one app instance. The browser implementation holds a lock across
// tabs for the whole editing session.
export async function claimProject(_id: string): Promise<boolean> {
	return true;
}

export async function releaseProject(_id: string) {}

/** Moves a picked photo into a project as `file`, and returns its URL there. */
export async function storeImage(
	id: string,
	file: string,
	uri: string,
): Promise<string> {
	const directory = projectDirectory(id);
	directory.create({ intermediates: true, idempotent: true });
	const image = new File(directory, file);
	await new File(uri).move(image, { overwrite: true });
	return image.uri;
}

export async function copyImage(fromId: string, file: string, toId: string) {
	const directory = projectDirectory(toId);
	directory.create({ intermediates: true, idempotent: true });
	await new File(projectDirectory(fromId), file).copy(
		new File(directory, file),
		{ overwrite: true },
	);
}

export async function imageUrl(id: string, file: string): Promise<string> {
	const image = new File(projectDirectory(id), file);
	if (!image.exists) {
		throw new Error(MISSING_IMAGE_MESSAGE);
	}
	return image.uri;
}

/** Nothing to free: an image's URL is a file path. */
export function releaseImage(_url: string) {}

/** The project's image files: every file in its folder but its JSON. */
export async function listImages(id: string): Promise<string[]> {
	const directory = projectDirectory(id);
	if (!directory.exists) return [];
	return directory
		.list()
		.filter(
			(entry) =>
				entry instanceof File &&
				entry.name !== PROJECT &&
				entry.name !== PROJECT_DRAFT,
		)
		.map((entry) => entry.name);
}

export async function removeImage(id: string, file: string) {
	const image = new File(projectDirectory(id), file);
	if (image.exists) image.delete();
}

/** The project's JSON, or null if it was never saved. */
export async function readProjectFile(id: string): Promise<string | null> {
	const directory = projectDirectory(id);
	// A draft outlives the saved file only if saving stopped between the two.
	for (const name of [PROJECT, PROJECT_DRAFT]) {
		const file = new File(directory, name);
		if (file.exists) return file.text();
	}
	return null;
}

/** Writes a draft first, so a save that's cut short can't leave half a file. */
export async function writeProjectFile(id: string, json: string) {
	const directory = projectDirectory(id);
	// A blank canvas's project may have no image to have made it already.
	directory.create({ intermediates: true, idempotent: true });
	const draft = new File(directory, PROJECT_DRAFT);
	draft.create({ overwrite: true });
	await draft.write(json);
	draft.moveSync(new File(directory, PROJECT), { overwrite: true });
}

export async function removeProject(id: string) {
	const directory = projectDirectory(id);
	if (directory.exists) directory.delete();
}

/** Removes an abandoned project after checking its latest saved state. */
export async function removeInactiveProject(
	id: string,
	shouldRemove: (json: string | null) => boolean,
) {
	if (shouldRemove(await readProjectFile(id))) await removeProject(id);
}

export async function listProjectIds(): Promise<string[]> {
	const directory = projectsDirectory();
	if (!directory.exists) return [];
	return directory
		.list()
		.filter((entry) => entry instanceof Directory)
		.map((entry) => entry.name);
}

// Checked against the shared contract here, so a drift from it fails in
// this file rather than at the wiring in `projectService.ts`.
const storage: ProjectStorage = {
	claimProject,
	releaseProject,
	storeImage,
	copyImage,
	imageUrl,
	releaseImage,
	listImages,
	removeImage,
	readProjectFile,
	writeProjectFile,
	removeProject,
	removeInactiveProject,
	listProjectIds,
};

export default storage;
