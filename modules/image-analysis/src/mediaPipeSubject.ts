import type * as Vision from "@mediapipe/tasks-vision";
import type { SubjectMask } from "./ImageAnalysis.types";
import { ASSETS, decode, lazyTask } from "./mediaPipe";

// MagicTouch looks at the image at 512 pixels, so a larger input only costs
// time and memory. The mask is stretched over the photo when it's drawn.
const MAX_SIDE = 1024;

// How sure a pixel must be to count as the subject when deciding there is one.
const SUBJECT_CONFIDENCE = 0.5;

// Version 1 of MagicTouch from Google's MediaPipe models, kept in the
// repository like the face model (see scripts/copy-web-assets.mjs).
const segmenter = lazyTask(
	(vision, fileset): Promise<Vision.InteractiveSegmenterLegacy> =>
		vision.InteractiveSegmenterLegacy.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: `${ASSETS}/magic_touch.tflite` },
			outputConfidenceMasks: true,
			outputCategoryMask: false,
		}),
);

/**
 * A mask of the subject at the image's center, which MagicTouch needs to be
 * told, as a grayscale PNG's blob URL: white where the subject is. Null when
 * it finds nothing there.
 */
export async function mediaPipeSubject(
	uri: string,
): Promise<SubjectMask | null> {
	const image = await decode(uri);
	let canvas: OffscreenCanvas;
	try {
		const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
		canvas = new OffscreenCanvas(
			Math.round(image.width * scale),
			Math.round(image.height * scale),
		);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Couldn't draw the image");
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
	} finally {
		image.close();
	}

	const result = (await segmenter()).segment(canvas, {
		keypoint: { x: 0.5, y: 0.5 },
	});
	try {
		// One mask per category: the background's, then the subject's.
		const mask = result.confidenceMasks?.at(-1);
		if (!mask) throw new Error("MediaPipe returned no mask");
		return await encodeMask(mask.getAsFloat32Array(), mask.width, mask.height);
	} finally {
		result.close();
	}
}

async function encodeMask(
	confidences: Float32Array,
	width: number,
	height: number,
): Promise<SubjectMask | null> {
	const pixels = new ImageData(width, height);
	let found = false;
	for (let i = 0; i < confidences.length; i++) {
		const confidence = confidences[i];
		if (confidence >= SUBJECT_CONFIDENCE) found = true;
		const value = Math.round(Math.min(1, Math.max(0, confidence)) * 255);
		pixels.data[i * 4] = value;
		pixels.data[i * 4 + 1] = value;
		pixels.data[i * 4 + 2] = value;
		pixels.data[i * 4 + 3] = 255;
	}
	if (!found) return null;
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Couldn't draw the mask");
	context.putImageData(pixels, 0, 0);
	const blob = await canvas.convertToBlob({ type: "image/png" });
	return { uri: URL.createObjectURL(blob), width, height };
}
