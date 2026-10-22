import {
	canSelectObjects,
	detectFaces,
	detectText,
	type Feature,
	type ImagePoint,
	isAvailable,
	type ObjectMasks,
	objectMasks,
	prepareObjects,
	type Rect,
	releaseObjects,
	type SubjectMask,
	subjectMask,
} from "image-analysis";

export type DetectionFeature = Exclude<Feature, "background">;
export type DetectionRect = Rect;
export type { SubjectMask };

const cachedDetections = new Map<string, Promise<DetectionRect[]>>();

/** Whether this device can run a detector. */
export function isDetectionAvailable(feature: DetectionFeature): boolean {
	return isAvailable(feature);
}

/** Whether this device can find a photo's subject to cut out. */
export function isCutOutAvailable(): boolean {
	return isAvailable("background");
}

export type { ImagePoint };

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

/** Lets go of what selecting objects holds, until it's needed again. */
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

/**
 * Finds selectable regions in an image. Text is proposed a line at a time:
 * that keeps screenshots quick to review without creating a layer per word.
 * Successful results are cached by file and feature; failed model downloads
 * are not, so Retry can ask Play services again.
 */
export function detectImageRegions(
	feature: DetectionFeature,
	uri: string,
): Promise<DetectionRect[]> {
	const key = `${feature}:${uri}`;
	const cached = cachedDetections.get(key);
	if (cached) return cached;

	const detection =
		feature === "faces"
			? detectFaces(uri)
			: detectText(uri).then((regions) => regions.map(({ line }) => line));
	const kept = detection
		.then((regions) => regions.map((region) => ({ ...region })))
		.catch((error: unknown) => {
			cachedDetections.delete(key);
			throw error;
		});
	cachedDetections.set(key, kept);
	return kept;
}

/** Android reports this while Play services fetches an install-time model. */
export function isDetectionModelDownloading(error: unknown): boolean {
	return (
		error instanceof Error &&
		/still being downloaded|try again in a moment/i.test(error.message)
	);
}
