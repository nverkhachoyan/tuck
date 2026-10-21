import type { ImagePoint, ObjectMasks } from "./ImageAnalysis.types";

// `objectSelection.web.ts` selects objects with Segment Anything; iOS and
// Android don't yet.

export function canSelectObjects(): boolean {
	return false;
}

export function prepareObjects(_uri: string): Promise<void> {
	return Promise.reject(new Error("Selecting objects isn't available here."));
}

export async function objectMasks(
	_uri: string,
	_at: ImagePoint,
): Promise<ObjectMasks | null> {
	return null;
}

export function releaseObjects() {}
