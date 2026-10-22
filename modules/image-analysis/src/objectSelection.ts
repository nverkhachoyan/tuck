import type { ImagePoint, ObjectMasks } from "./ImageAnalysis.types";
import ImageAnalysisModule from "./ImageAnalysisModule";

// Segment Anything runs in the native module, as `objectSelection.web.ts`
// runs it in a worker.

let prepared: { uri: string; ready: boolean; done: Promise<void> } | null =
	null;

export function canSelectObjects(): boolean {
	return ImageAnalysisModule.canSelectObjects();
}

/**
 * Starts reading the image at `uri` for selecting objects in it: loads the
 * model, the first time, and encodes the image. Resolves once taps on it can
 * be answered. A new image takes the place of the last.
 */
export function prepareObjects(uri: string): Promise<void> {
	if (prepared?.uri === uri) return prepared.done;
	const preparing: NonNullable<typeof prepared> = {
		uri,
		ready: false,
		done: Promise.resolve(),
	};
	preparing.done = ImageAnalysisModule.prepareObjects(uri).then(() => {
		if (prepared === preparing) preparing.ready = true;
	});
	preparing.done.catch(() => {
		if (prepared === preparing) prepared = null;
	});
	prepared = preparing;
	return preparing.done;
}

/**
 * Masks of what's at a point in the image at `uri` (see `ObjectMasks`), as
 * grayscale PNG files. Null while the image isn't ready (see
 * `prepareObjects`).
 */
export async function objectMasks(
	uri: string,
	at: ImagePoint,
): Promise<ObjectMasks | null> {
	if (!prepared?.ready || prepared.uri !== uri) return null;
	return ImageAnalysisModule.objectMasks(uri, at);
}

export function releaseObjects() {
	prepared = null;
	ImageAnalysisModule.releaseObjects().catch(() => {});
}
