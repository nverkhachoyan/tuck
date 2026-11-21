import { Directory, File, Paths } from "expo-file-system";
import { MISSING_IMAGE_MESSAGE, type ProjectStorage } from "./openProjects.ts";

// `projectStorage.web.ts` implements the same API for browsers. Each project
// is a folder holding its image files, if it has any, and once it has been
// saved, its JSON. An image's canvas preview is kept under the same name in
// the project's cache folder: the system may purge it, and the project
// rebuilds it on open.

const PROJECT = "project.json";
const PROJECT_DRAFT = "project.json.tmp";

const projectsDirectory = () => new Directory(Paths.document, "projects");
const projectDirectory = (id: string) => new Directory(projectsDirectory(), id);
const previewDirectory = (id: string) =>
	new Directory(Paths.cache, "previews", id);

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

/** Moves an image's canvas preview into the project's cache folder, and returns its URL. */
export async function storePreview(
	id: string,
	file: string,
	uri: string,
): Promise<string> {
	const directory = previewDirectory(id);
	directory.create({ intermediates: true, idempotent: true });
	const preview = new File(directory, file);
	await new File(uri).move(preview, { overwrite: true });
	return preview.uri;
}

/** Copies an image, and its preview if it has one. */
export async function copyImage(fromId: string, file: string, toId: string) {
	const directory = projectDirectory(toId);
	directory.create({ intermediates: true, idempotent: true });
	await new File(projectDirectory(fromId), file).copy(
		new File(directory, file),
		{ overwrite: true },
	);
	const preview = new File(previewDirectory(fromId), file);
	if (!preview.exists) return;
	// A missing preview is rebuilt on open, so a failed copy costs only time.
	try {
		const previews = previewDirectory(toId);
		previews.create({ intermediates: true, idempotent: true });
		await preview.copy(new File(previews, file), { overwrite: true });
	} catch (error) {
		console.warn("Couldn't copy the photo's preview", error);
	}
}

export async function imageUrl(id: string, file: string): Promise<string> {
	const image = new File(projectDirectory(id), file);
	if (!image.exists) {
		throw new Error(MISSING_IMAGE_MESSAGE);
	}
	return image.uri;
}

export async function previewUrl(
	id: string,
	file: string,
): Promise<string | null> {
	const preview = new File(previewDirectory(id), file);
	return preview.exists ? preview.uri : null;
}

/** Nothing to free: an image's URL is a file path. */
export function releaseImage(_url: string) {}

/** The project's image files: every file in its folder but its JSON. */
/**
 * The project's image files: every file in its folder but its JSON, and any
 * preview whose image is gone, which builds before previews went with their
 * images left behind, so that removing unused images clears them.
 */
export async function listImages(id: string): Promise<string[]> {
	const names = (directory: Directory) =>
		directory.exists
			? directory
					.list()
					.filter((entry) => entry instanceof File)
					.map((entry) => entry.name)
			: [];
	const images = names(projectDirectory(id)).filter(
		(name) => name !== PROJECT && name !== PROJECT_DRAFT,
	);
	return [...new Set([...images, ...names(previewDirectory(id))])];
}

export async function removeImage(id: string, file: string) {
	for (const directory of [projectDirectory(id), previewDirectory(id)]) {
		const image = new File(directory, file);
		if (image.exists) image.delete();
	}
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
	for (const directory of [projectDirectory(id), previewDirectory(id)]) {
		if (directory.exists) directory.delete();
	}
}

/** Removes an abandoned project after checking its latest saved state. */
export async function removeInactiveProject(
	id: string,
	shouldRemove: (json: string | null) => boolean,
) {
	if (shouldRemove(await readProjectFile(id))) await removeProject(id);
}

/**
 * Every project's id, including any that only has previews left: builds
 * before previews went with their projects left them, and a project with no
 * JSON is removed when listed.
 */
export async function listProjectIds(): Promise<string[]> {
	const names = (directory: Directory) =>
		directory.exists
			? directory
					.list()
					.filter((entry) => entry instanceof Directory)
					.map((entry) => entry.name)
			: [];
	return [
		...new Set([
			...names(projectsDirectory()),
			...names(new Directory(Paths.cache, "previews")),
		]),
	];
}

// Checked against the shared contract here, so a drift from it fails in
// this file rather than at the wiring in `projectService.ts`.
const storage: ProjectStorage = {
	claimProject,
	releaseProject,
	storeImage,
	storePreview,
	copyImage,
	imageUrl,
	previewUrl,
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
