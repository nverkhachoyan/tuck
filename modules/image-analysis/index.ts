import type { Feature, TextRegion } from "./src/ImageAnalysis.types";
import ImageAnalysisModule from "./src/ImageAnalysisModule";

export type { Feature, Rect, TextRegion } from "./src/ImageAnalysis.types";

/**
 * Whether this device can find `feature`. Android needs Google Play services,
 * which some phones (Huawei's, say) don't have.
 */
export function isAvailable(feature: Feature): boolean {
	return ImageAnalysisModule.isAvailable(feature);
}

/**
 * Every line of text in the image at `uri`, with a box for the line and one
 * for each word, in the image's pixels once its EXIF orientation is applied.
 */
export function detectText(uri: string): Promise<TextRegion[]> {
	return ImageAnalysisModule.detectText(uri);
}
