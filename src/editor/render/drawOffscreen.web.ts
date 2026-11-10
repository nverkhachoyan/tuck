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

// Drawings run one after another, each once the last has settled, so only
// one at a time holds the surface. Otherwise one resuming from
// `drawAsPicture` could grow or free the surface, or let the idle timer free
// it, in the microtask between another's readback and its
// `snapshot.dispose()`. At Skia 3.9.0 the readback itself runs synchronously;
// should an upgrade make it asynchronous, this chain is what keeps drawings
// apart. A failure reaches its caller and doesn't stop the next drawing. No
// drawing calls this from inside another, so the chain can't wait on itself.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Draws `element` into an image `size` pixels across, offscreen, as Skia's
 * `drawAsImage` does, but into one surface kept between drawings and freed
 * once idle. Skia's offscreen surfaces share a WebGL context that lives as
 * long as the page, and `drawAsImage` never disposes its surface, so an
 * export's render target (a camera photo's is hundreds of megabytes) would
 * wait for garbage collection. The image comes back on the CPU, as
 * `drawAsImage`'s does, so it doesn't depend on the surface.
 */
export function drawOffscreen(
	element: ReactElement,
	size: { width: number; height: number },
): Promise<SkImage | null> {
	const drawn = queue.then(() => draw(element, size));
	queue = drawn.catch(() => undefined);
	return drawn;
}

async function draw(
	element: ReactElement,
	size: { width: number; height: number },
): Promise<SkImage | null> {
	const picture = await drawAsPicture(element);
	try {
		const surface = surfaceFor(size.width, size.height);
		if (!surface) return null;
		const canvas = surface.getCanvas();
		canvas.clear(Skia.Color("transparent"));
		// Flushing makes the surface's WebGL context current. A photo from
		// `offscreenPhotos` uploads into the current context as it's drawn,
		// and since the last drawing here an onscreen canvas may have taken it.
		surface.flush();
		canvas.drawPicture(picture);
		surface.flush();
		const snapshot = surface.makeImageSnapshot(
			Skia.XYWHRect(0, 0, size.width, size.height),
		);
		try {
			return await snapshot.makeRasterImage();
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
 * A GPU surface on a WebGL context of its own, which `free` gives back with
 * every texture drawn into it (the export's photos). Skia's
 * `Skia.Surface.MakeOffscreen` draws on its shared context instead, which
 * is never freed. This frees what Skia's own web canvas frees when it
 * unmounts.
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
