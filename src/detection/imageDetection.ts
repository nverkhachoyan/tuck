import {
	detectFaces,
	detectText,
	type Feature,
	isAvailable,
	type Rect,
} from "image-analysis";

export type DetectionFeature = Feature;
export type DetectionRect = Rect;

const cachedDetections = new Map<string, Promise<DetectionRect[]>>();

/** Whether this device can run a detector. */
export function isDetectionAvailable(feature: DetectionFeature): boolean {
	return isAvailable(feature);
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
