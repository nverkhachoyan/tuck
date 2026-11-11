import type { ReactElement } from "react";
import { drawAsImage, type SkImage } from "react-native-skia";
import { retainDrawingPictures } from "../layers/drawing/DrawingLayerView";

/**
 * Draws `element` into an image `size` pixels across, offscreen. Skia's own
 * `drawAsImage` here; web draws into one shared surface instead (see
 * `drawOffscreen.web.ts`).
 */
export async function drawOffscreen(
	element: ReactElement,
	size: { width: number; height: number },
): Promise<SkImage | null> {
	const release = retainDrawingPictures();
	try {
		return await drawAsImage(element, size);
	} finally {
		release();
	}
}
