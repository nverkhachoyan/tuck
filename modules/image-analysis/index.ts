import { Platform } from "react-native";
import { faceTiles, mergeFaces } from "./src/faceTiles";
import type {
	Feature,
	Rect,
	SubjectMask,
	TextRegion,
} from "./src/ImageAnalysis.types";
import ImageAnalysisModule from "./src/ImageAnalysisModule";

export type {
	Feature,
	Rect,
	SubjectMask,
	TextRegion,
} from "./src/ImageAnalysis.types";

/**
 * Whether this device can find `feature`. Android needs Google Play services,
 * which some phones (Huawei's, say) don't have, and iOS needs version 17 to
 * find the background.
 */
export function isAvailable(feature: Feature): boolean {
	return ImageAnalysisModule.isAvailable(feature);
}

/**
 * A box around every face in the image at `uri`, in the image's pixels once
 * its EXIF orientation is applied.
 */
export async function detectFaces(uri: string): Promise<Rect[]> {
	const { width, height } = await ImageAnalysisModule.imageSize(uri);
	// ML Kit looks at the image at every scale itself, so tiles only slow it.
	const tiles =
		Platform.OS === "android"
			? [{ x: 0, y: 0, width, height }]
			: faceTiles(width, height);
	const found = await ImageAnalysisModule.detectFaces(uri, tiles);
	return mergeFaces(tiles, found, width, height);
}

/**
 * Every line of text in the image at `uri`, with a box for the line and one
 * for each word, in the image's pixels once its EXIF orientation is applied.
 */
export function detectText(uri: string): Promise<TextRegion[]> {
	return ImageAnalysisModule.detectText(uri);
}

/**
 * A mask of the image's subject (people, pets, or objects in front), for
 * cutting it out of its background, or null if there's none. It's the same
 * way up as the image once its EXIF orientation is applied. On web, the
 * subject is whatever is at the image's center.
 */
export function subjectMask(uri: string): Promise<SubjectMask | null> {
	return ImageAnalysisModule.subjectMask(uri);
}
