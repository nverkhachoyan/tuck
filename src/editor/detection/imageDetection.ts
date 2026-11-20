import {
	detectFaces,
	detectText,
	type Feature,
	isAvailable,
	type Rect,
} from "image-analysis";

export type DetectionFeature = Exclude<Feature, "background">;
export type DetectionRect = Rect;
// A region found: a face, or a line of text with the boxes of its words.
export type DetectionRegion = DetectionRect & { words?: DetectionRect[] };

const cachedDetections = new Map<string, Promise<DetectionRegion[]>>();

export function isDetectionAvailable(feature: DetectionFeature): boolean {
	return isAvailable(feature);
}

/**
 * Finds selectable regions in an image. Text is proposed a line at a time,
 * which keeps screenshots quick to review, with its words' boxes so a line
 * can be narrowed to some of them. Successful results are cached by file and feature; failed model downloads
 * are not, so Retry can ask Play services again.
 */
export function detectImageRegions(
	feature: DetectionFeature,
	uri: string,
): Promise<DetectionRegion[]> {
	const key = `${feature}:${uri}`;
	const cached = cachedDetections.get(key);
	if (cached) return cached;

	const detection: Promise<DetectionRegion[]> =
		feature === "faces"
			? detectFaces(uri).then((faces) => faces.map((face) => ({ ...face })))
			: detectText(uri).then((regions) =>
					regions.map(({ line, words }) => ({
						...line,
						words: words.map((word) => ({ ...word })),
					})),
				);
	const kept = detection.catch((error: unknown) => {
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
