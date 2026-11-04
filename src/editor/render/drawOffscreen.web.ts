import type { ReactElement } from "react";
import { drawAsPicture, type SkImage, Skia } from "react-native-skia";
import { JsiSkSurface } from "react-native-skia/lib/module/skia/web/JsiSkSurface";

// How long the shared surface outlives its last drawing, so its GPU memory
// (a camera photo's is hundreds of megabytes) goes once export is done.
const IDLE_MS = 10_000;

// A surface with the WebGL context it draws with, all freed together.
type Offscreen = {
	surface: JsiSkSurface;
	free: () => void;
};

// One offscreen surface for every drawing, grown as larger ones come.
let shared: Offscreen | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Draws `element` into an image `size` pixels across, offscreen, as Skia's
 * `drawAsImage` does, but into one surface kept between drawings. On web,
 * each of `drawAsImage`'s surfaces holds a WebGL context of its own, and a
 * browser keeps only so many: a few quick changes of export size lost the
 * oldest, the editor's or the export preview's canvas among them. The image
 * comes back on the CPU, as `drawAsImage`'s does, so it doesn't depend on
 * the surface.
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
			shared?.free();
			shared = null;
		}, IDLE_MS);
	}
}

// The shared surface, made or grown to hold `width` by `height`.
function surfaceFor(width: number, height: number): JsiSkSurface | null {
	if (
		shared &&
		shared.surface.width() >= width &&
		shared.surface.height() >= height
	) {
		return shared.surface;
	}
	const grownWidth = Math.max(width, shared?.surface.width() ?? 0);
	const grownHeight = Math.max(height, shared?.surface.height() ?? 0);
	shared?.free();
	shared = makeOffscreen(grownWidth, grownHeight);
	return shared?.surface ?? null;
}

/**
 * A GPU surface on a WebGL context of its own, which `free` gives back.
 * Skia's `Skia.Surface.MakeOffscreen` makes one too, but its `dispose`
 * frees only the surface: the context stays registered with CanvasKit, so
 * it's never collected, and keeps its drawing buffer and every texture
 * drawn into it (the export's photos) until the browser drops it as the
 * oldest. This frees what Skia's own web canvas frees when it unmounts.
 */
function makeOffscreen(width: number, height: number): Offscreen | null {
	const offscreen = new OffscreenCanvas(width, height);
	const handle = CanvasKit.GetWebGLContext(offscreen);
	if (!handle) return null;
	const gl = offscreen.getContext("webgl2") ?? offscreen.getContext("webgl");
	const grContext = CanvasKit.MakeWebGLContext(handle);
	const surface =
		grContext && CanvasKit.MakeRenderTarget(grContext, width, height);
	const free = () => {
		surface?.delete();
		grContext?.releaseResourcesAndAbandonContext();
		grContext?.delete();
		// The context's GPU memory goes now rather than when it's collected.
		gl?.getExtension("WEBGL_lose_context")?.loseContext();
		CanvasKit.deleteContext(handle);
		// Making the deleted handle current clears CanvasKit's references to
		// the context, as Skia's web canvas does when it unmounts.
		CanvasKit.MakeWebGLContext(handle);
	};
	if (!surface) {
		free();
		return null;
	}
	return { surface: new JsiSkSurface(CanvasKit, surface), free };
}
