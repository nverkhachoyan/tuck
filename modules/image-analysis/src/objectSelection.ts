import type { ObjectMasks, ObjectPrompt } from "./ImageAnalysis.types";
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
 * Masks of the object `prompt` points at or boxes in the image at `uri` (see
 * `ObjectMasks`), as grayscale PNG files. Null while a point's image isn't
 * ready (see `prepareObjects`); a box waits for its image, and is null only
 * if reading it fails or it's let go meanwhile.
 */
export async function objectMasks(
	uri: string,
	prompt: ObjectPrompt,
): Promise<ObjectMasks | null> {
	if (!(await whenRead(uri, prompt))) return null;
	return ImageAnalysisModule.objectMasks(uri, prompt);
}

// Whether the image at `uri` is read for `prompt`: a point takes it only
// once it's ready, while a box waits for it, since the subject at a box's
// center is a poor stand-in for what it boxes.
async function whenRead(uri: string, prompt: ObjectPrompt): Promise<boolean> {
	const reading = prepared?.uri === uri ? prepared : null;
	if (!reading) return false;
	if (reading.ready) return true;
	if (!("box" in prompt)) return false;
	try {
		await reading.done;
	} catch {
		return false;
	}
	return prepared === reading;
}

export function releaseObjects() {
	prepared = null;
	ImageAnalysisModule.releaseObjects().catch(() => {});
}
