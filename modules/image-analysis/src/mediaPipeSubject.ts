import type * as Vision from "@mediapipe/tasks-vision";
import type { ImagePoint, SubjectMask } from "./ImageAnalysis.types";
import { ASSETS, decode, lazyTask } from "./mediaPipe";
import {
	AUTO_SUBJECT_POINTS,
	chooseSubjectMask,
	isPlausibleSubject,
	SUBJECT_CONFIDENCE,
	type SubjectMaskStats,
	subjectMaskIndex,
	subjectMaskStats,
} from "./subjectPrompt";

// MagicTouch looks at the image at 512 pixels, so a larger input only costs
// time and memory. The mask is stretched over the photo when it's drawn.
const MAX_SIDE = 1024;

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

type Foreground = {
	data: Float32Array;
	width: number;
	height: number;
};

/**
 * A mask of the subject at `at`, or, with no point, the most plausible
 * subject among a few prompts. It's a grayscale PNG's blob URL, white where
 * the subject is. Null when nothing there looks like a subject.
 * - A tap segments that point, including a small object.
 * - Remove BG, which passes no point, tries the rule-of-thirds grid on
 *   the one loaded segmenter and keeps the mask `chooseSubjectMask` picks.
 *   A speck or a mask of almost the whole frame is not applied.
 */
export async function mediaPipeSubject(
	uri: string,
	at: ImagePoint | null,
): Promise<SubjectMask | null> {
	const canvas = await subjectCanvas(uri);
	const segment = await segmenter();
	if (at) {
		const mask = foregroundAt(segment, canvas, at);
		return encodeMask(mask.data, mask.width, mask.height);
	}

	const found: { stats: SubjectMaskStats; mask: Foreground }[] = [];
	for (let i = 0; i < AUTO_SUBJECT_POINTS.length; i++) {
		const point = AUTO_SUBJECT_POINTS[i];
		if (!point) continue;
		const mask = foregroundAt(segment, canvas, point);
		const stats = subjectMaskStats(mask.data, mask.width, mask.height);
		// Drop a speck before keeping its pixels. The choice still rejects
		// one that slips through.
		if (isPlausibleSubject(stats)) found.push({ stats, mask });
		if (i < AUTO_SUBJECT_POINTS.length - 1) await yieldToMain();
	}
	const chosen = chooseSubjectMask(found);
	if (!chosen) return null;
	return encodeMask(chosen.data, chosen.width, chosen.height);
}

async function subjectCanvas(uri: string): Promise<OffscreenCanvas> {
	const image = await decode(uri);
	try {
		const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
		const canvas = new OffscreenCanvas(
			Math.round(image.width * scale),
			Math.round(image.height * scale),
		);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Couldn't draw the image");
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		return canvas;
	} finally {
		image.close();
	}
}

/** The subject channel at `at`, copied out before the result is freed. */
function foregroundAt(
	segment: Vision.InteractiveSegmenterLegacy,
	canvas: OffscreenCanvas,
	at: ImagePoint,
): Foreground {
	const result = segment.segment(canvas, { keypoint: at });
	try {
		const masks = result.confidenceMasks;
		const index = subjectMaskIndex(masks?.length ?? 0);
		const mask = index === null || !masks ? undefined : masks[index];
		if (!mask) throw new Error("MediaPipe returned no mask");
		// Copied before close: the view is freed with the result.
		return {
			data: new Float32Array(mask.getAsFloat32Array()),
			width: mask.width,
			height: mask.height,
		};
	} finally {
		result.close();
	}
}

// MagicTouch's inference blocks the main thread. A gap lets the busy state
// paint between prompts.
function yieldToMain(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

async function encodeMask(
	confidences: Float32Array,
	width: number,
	height: number,
): Promise<SubjectMask | null> {
	const pixels = new ImageData(width, height);
	let found = false;
	for (let i = 0; i < confidences.length; i++) {
		const confidence = confidences[i] ?? 0;
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
