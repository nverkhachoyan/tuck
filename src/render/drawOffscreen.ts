import type { ReactElement } from "react";
import { drawAsImage, type SkImage } from "react-native-skia";

/**
 * Draws `element` into an image `size` pixels across, offscreen. Skia's own
 * `drawAsImage` here; web draws into one shared surface instead (see
 * `drawOffscreen.web.ts`).
 */
export function drawOffscreen(
	element: ReactElement,
	size: { width: number; height: number },
): Promise<SkImage | null> {
	return drawAsImage(element, size);
}
