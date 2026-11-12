import {
	canSelectObjects,
	type ImageBox,
	type ImagePoint,
	isAvailable,
	type ObjectMasks,
	type ObjectPrompt,
	objectMasks,
	prepareObjects,
	releaseObjects,
	type SubjectMask,
	subjectMask,
} from "image-analysis";

export type { ImageBox, ImagePoint, ObjectPrompt };

export function isCutOutAvailable(): boolean {
	return isAvailable("background");
}

/**
 * A mask of the subjects in the image at `uri`, as a new image file of its
 * own, or null when there's none. With `at`, it's only the subject there;
 * without, on web it's whatever is at the center.
 */
export function findSubjectMask(
	uri: string,
	at?: ImagePoint,
): Promise<SubjectMask | null> {
	return subjectMask(uri, at);
}

/**
 * Starts getting ready to select any object in the image at `uri`, not only
 * its subjects, with Segment Anything, where this device can: the model
 * loads, the first time, and reads the image. Until it's done, taps pick
 * subjects as before and boxes wait for it; if it fails, both pick
 * subjects.
 */
export function prepareObjectSelection(uri: string) {
	if (!canSelectObjects()) return;
	prepareObjects(uri).catch((error: unknown) => {
		console.warn("Couldn't get ready to select objects", error);
	});
}

export function releaseObjectSelection() {
	releaseObjects();
}

/**
 * Masks of the object `prompt` points at or boxes in the image at `uri`, as
 * new image files, each its own (see `ObjectMasks`), once the image is
 * ready to select any object (see `prepareObjectSelection`; a box waits for
 * it), or else the one subject there (at a box's center, when reading the
 * image failed or this device can't). No masks when there's nothing there.
 */
export async function findObjectMasks(
	uri: string,
	prompt: ObjectPrompt,
): Promise<ObjectMasks> {
	const objects = await objectMasks(uri, prompt);
	if (objects) return objects;
	const subject = await subjectMask(uri, promptCenter(prompt));
	return { masks: subject ? [subject] : [], likeliest: 0 };
}

/** The point a prompt names, or the middle of the box it draws. */
export function promptCenter(prompt: ObjectPrompt): ImagePoint {
	if ("point" in prompt) return prompt.point;
	const { box } = prompt;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Android reports this while Play services fetches an install-time model. */
export function isSubjectModelDownloading(error: unknown): boolean {
	return (
		error instanceof Error &&
		/still being downloaded|try again in a moment/i.test(error.message)
	);
}
