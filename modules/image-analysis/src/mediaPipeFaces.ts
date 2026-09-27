import type * as Vision from "@mediapipe/tasks-vision";
import type { Rect, Size } from "./ImageAnalysis.types";

// Copied into public/ by scripts/copy-web-assets.mjs, so nothing is fetched
// from a CDN or Google's storage.
const ASSETS = "/mediapipe";

let detector: Promise<Vision.FaceDetector> | undefined;

// Started on first use, so neither the library nor its WebAssembly loads
// until someone looks for faces.
function faceDetector(): Promise<Vision.FaceDetector> {
	if (!detector) {
		const starting = loadVision().then(
			async ({ FaceDetector, FilesetResolver }) =>
				FaceDetector.createFromOptions(
					await FilesetResolver.forVisionTasks(ASSETS),
					{
						// The full-range model finds the small faces in group
						// photos, which the default, made for selfies, misses.
						baseOptions: {
							modelAssetPath: `${ASSETS}/blaze_face_full_range.tflite`,
						},
						runningMode: "IMAGE",
					},
				),
		);
		// Try again next time, say once the connection is back.
		starting.catch(() => {
			if (detector === starting) detector = undefined;
		});
		detector = starting;
	}
	return detector;
}

// Metro can't bundle the library: every build of it calls `import()` with a
// computed path, which Metro rejects. Its script build defines a global
// `Vision` instead.
function loadVision(): Promise<typeof Vision> {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = `${ASSETS}/vision_bundle.js`;
		script.onload = () => {
			const vision = (globalThis as { Vision?: typeof Vision }).Vision;
			if (vision) resolve(vision);
			else reject(new Error("MediaPipe didn't load"));
		};
		script.onerror = () => {
			script.remove();
			reject(new Error("Couldn't load MediaPipe"));
		};
		document.head.append(script);
	});
}

// MediaPipe looks at the pixels it's handed, so the image is decoded with its
// EXIF orientation applied first.
async function decode(uri: string): Promise<ImageBitmap> {
	const response = await fetch(uri);
	if (!response.ok) throw new Error(`Couldn't read the image at ${uri}`);
	return createImageBitmap(await response.blob(), {
		imageOrientation: "from-image",
	});
}

export async function imageSize(uri: string): Promise<Size> {
	const image = await decode(uri);
	const { width, height } = image;
	image.close();
	return { width, height };
}

export async function mediaPipeFaces(
	uri: string,
	tiles: Rect[],
): Promise<Rect[][]> {
	const image = await decode(uri);
	try {
		const detector = await faceDetector();
		return tiles.map((tile) => {
			// A canvas of its own: MediaPipe fails on one resized between calls.
			const canvas = new OffscreenCanvas(tile.width, tile.height);
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Couldn't draw the image");
			context.drawImage(image, -tile.x, -tile.y);
			return detector.detect(canvas).detections.flatMap(({ boundingBox }) =>
				boundingBox
					? [
							{
								x: tile.x + boundingBox.originX,
								y: tile.y + boundingBox.originY,
								width: boundingBox.width,
								height: boundingBox.height,
							},
						]
					: [],
			);
		});
	} finally {
		image.close();
	}
}
