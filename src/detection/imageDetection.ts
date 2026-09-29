import {
	detectFaces,
	detectText,
	type Feature,
	isAvailable,
	type Rect,
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

/**
 * A mask of the subject in the image at `uri`, as a new image file of its
 * own, or null when there's none. On web it's whatever is at the center.
 */
export function findSubjectMask(uri: string): Promise<SubjectMask | null> {
	return subjectMask(uri);
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
