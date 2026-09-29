import type * as Vision from "@mediapipe/tasks-vision";
import type { Rect, Size } from "./ImageAnalysis.types";
import { ASSETS, decode, lazyTask } from "./mediaPipe";

const faceDetector = lazyTask(
	(vision, fileset): Promise<Vision.FaceDetector> =>
		vision.FaceDetector.createFromOptions(fileset, {
			// The full-range model finds the small faces in group photos, which
			// the default, made for selfies, misses.
			baseOptions: {
				modelAssetPath: `${ASSETS}/blaze_face_full_range.tflite`,
			},
			runningMode: "IMAGE",
		}),
);

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
