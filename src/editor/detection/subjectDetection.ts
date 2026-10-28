import {
	canSelectObjects,
	type ImagePoint,
	isAvailable,
	type ObjectMasks,
	objectMasks,
	prepareObjects,
	releaseObjects,
	type SubjectMask,
	subjectMask,
} from "image-analysis";

export type { ImagePoint };

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
 * subjects as before; if it fails, they go on doing so.
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
 * Masks of what's at a point in the image at `uri`, as new image files, each
 * its own (see `ObjectMasks`), once the image is ready to select any object
 * (see `prepareObjectSelection`), or else the one subject there. No masks
 * when there's nothing there.
 */
export async function findObjectMasks(
	uri: string,
	at: ImagePoint,
): Promise<ObjectMasks> {
	const objects = await objectMasks(uri, at);
	if (objects) return objects;
	const subject = await subjectMask(uri, at);
	return { masks: subject ? [subject] : [], likeliest: 0 };
}

/** Android reports this while Play services fetches an install-time model. */
export function isSubjectModelDownloading(error: unknown): boolean {
	return (
		error instanceof Error &&
		/still being downloaded|try again in a moment/i.test(error.message)
	);
}
