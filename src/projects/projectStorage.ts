import { Directory, File, Paths } from "expo-file-system";
import { PHOTO_FILE } from "./projectFile";

// `projectStorage.web.ts` implements the same API for browsers. Each project
// is a folder holding its photo and, once it has been saved, its JSON.

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

/** Moves a picked photo into a new project, and returns its URL there. */
export async function storePhoto(id: string, uri: string): Promise<string> {
	const directory = projectDirectory(id);
	directory.create({ intermediates: true, idempotent: true });
	const photo = new File(directory, PHOTO_FILE);
	await new File(uri).move(photo, { overwrite: true });
	return photo.uri;
}

export async function photoUrl(id: string): Promise<string> {
	return new File(projectDirectory(id), PHOTO_FILE).uri;
}

/** Nothing to free: the photo's URL is a file path. */
export function releasePhoto(_url: string) {}

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
	const draft = new File(directory, PROJECT_DRAFT);
	draft.create({ overwrite: true });
	draft.write(json);
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
