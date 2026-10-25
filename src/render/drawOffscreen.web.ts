import {
	drawAsPicture,
	type SkImage,
	Skia,
	type SkSurface,
} from "@shopify/react-native-skia";
import type { ReactElement } from "react";

// How long the shared surface outlives its last drawing, so its GPU memory
// (a camera photo's is tens of megabytes) goes once export is done.
const IDLE_MS = 10_000;

// One offscreen surface for every drawing, grown as larger ones come.
let shared: SkSurface | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Draws `element` into an image `size` pixels across, offscreen, as Skia's
 * `drawAsImage` does, but into one surface kept between drawings. On web,
 * each of `drawAsImage`'s surfaces holds a WebGL context of its own until
 * it's garbage collected, and a browser keeps only so many: a few quick
 * changes of export size lost the oldest, the editor's or the export
 * preview's canvas among them. The image comes back on the CPU, as
 * `drawAsImage`'s does, so it doesn't depend on the surface.
 */
export async function drawOffscreen(
	element: ReactElement,
	size: { width: number; height: number },
): Promise<SkImage | null> {
	const picture = await drawAsPicture(element);
	try {
		const surface = surfaceFor(size.width, size.height);
		if (!surface) return null;
		const canvas = surface.getCanvas();
		canvas.clear(Skia.Color("transparent"));
		canvas.drawPicture(picture);
		surface.flush();
		const snapshot = surface.makeImageSnapshot(
			Skia.XYWHRect(0, 0, size.width, size.height),
		);
		try {
			return snapshot.makeNonTextureImage();
		} finally {
			snapshot.dispose();
		}
	} finally {
		picture.dispose();
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => {
			shared?.dispose();
			shared = null;
		}, IDLE_MS);
	}
}

// The shared surface, made or grown to hold `width` by `height`.
function surfaceFor(width: number, height: number): SkSurface | null {
	if (shared && shared.width() >= width && shared.height() >= height) {
		return shared;
	}
	const grown = Skia.Surface.MakeOffscreen(
		Math.max(width, shared?.width() ?? 0),
		Math.max(height, shared?.height() ?? 0),
	);
	shared?.dispose();
	shared = grown;
	return shared;
}
