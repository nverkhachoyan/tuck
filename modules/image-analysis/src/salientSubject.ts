import type { SubjectMask } from "./ImageAnalysis.types";
import { decode } from "./mediaPipe";
import { refineBoxMask } from "./objectSelection.web";
import {
	evaluateSalientMask,
	MIN_REFINEMENT_IOU,
	maskAgreementIoU,
	salientSubjectBoxes,
} from "./salientMask";

const INPUT_SIDE = 320;
// Aspect-preserving fallback mask resolution when MobileSAM is skipped or
// disagrees with U²-Net-p.
const MAX_MASK_SIDE = 1024;

type Reply = {
	id: number;
	error?: string;
	probs?: Float32Array;
	side?: number;
};

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (reply: Reply) => void>();

function ask(message: object, transfer: Transferable[] = []): Promise<Reply> {
	if (!worker) {
		worker = new Worker("/salient-subject-worker.js", { type: "module" });
		worker.addEventListener("message", ({ data }: MessageEvent<Reply>) => {
			waiting.get(data.id)?.(data);
			waiting.delete(data.id);
		});
		worker.addEventListener("error", (event) => {
			worker?.terminate();
			worker = null;
			const error = event.message || "Salient subject worker failed";
			for (const resolve of waiting.values()) resolve({ id: -1, error });
			waiting.clear();
		});
	}
	const id = nextId++;
	const reply = new Promise<Reply>((resolve) => waiting.set(id, resolve));
	worker.postMessage({ ...message, id }, transfer);
	return reply.then((answer) => {
		if (answer.error !== undefined) throw new Error(answer.error);
		return answer;
	});
}

/**
 * A mask of the salient foreground subjects in the image at `uri`:
 * - Stage 1 runs U²-Net-p (320×320) in an ONNX Runtime Web worker to locate
 *   salient subjects anywhere in the frame and reject empty scenes.
 * - Stage 2 refines each subject box with MobileSAM (up to 2048 px on crops
 *   for small subjects, 1024 px on whole images) for crisp edges, falling back
 *   to U²-Net-p's mask if MobileSAM fails or disagrees (`IoU < 0.70`).
 */
export async function salientSubject(uri: string): Promise<SubjectMask | null> {
	const image = await decode(uri);
	const scale = Math.min(
		1,
		MAX_MASK_SIDE / Math.max(image.width, image.height),
	);
	const outputWidth = Math.max(1, Math.round(image.width * scale));
	const outputHeight = Math.max(1, Math.round(image.height * scale));
	let sized: ImageBitmap;
	try {
		sized = await createImageBitmap(image, {
			resizeWidth: INPUT_SIDE,
			resizeHeight: INPUT_SIDE,
			resizeQuality: "high",
		});
	} finally {
		image.close();
	}
	const { probs, side = INPUT_SIDE } = await ask(
		{ type: "segment", image: sized },
		[sized],
	);
	if (!probs || !evaluateSalientMask(probs).hasSubject) return null;

	const refined = await tryRefineWithSam(uri, probs, side);
	if (refined) return refined;
	return encodeSalientMask(probs, side, outputWidth, outputHeight);
}

async function tryRefineWithSam(
	uri: string,
	probs: Float32Array,
	side: number,
): Promise<SubjectMask | null> {
	const boxes = salientSubjectBoxes(probs, side);
	if (boxes.length === 0) return null;

	const parts: SubjectMask[] = [];
	try {
		for (const box of boxes) {
			const mask = await refineBoxMask(uri, box);
			if (mask) parts.push(mask);
		}
		if (parts.length === 0) return null;

		const candidate =
			parts.length === 1 ? parts[0] : await combineMaskParts(parts);
		if (!candidate) return null;

		const iou = await maskBlobIoU(probs, side, candidate.uri);
		if (iou >= MIN_REFINEMENT_IOU) {
			// Revoke any intermediate parts that were combined into a new URL.
			for (const part of parts) {
				if (part.uri !== candidate.uri) URL.revokeObjectURL(part.uri);
			}
			return candidate;
		}
		if (parts.every((part) => part.uri !== candidate.uri)) {
			URL.revokeObjectURL(candidate.uri);
		}
		for (const part of parts) URL.revokeObjectURL(part.uri);
		return null;
	} catch (error) {
		for (const part of parts) URL.revokeObjectURL(part.uri);
		console.warn("Couldn't refine salient subject with MobileSAM", error);
		return null;
	}
}

async function combineMaskParts(
	parts: readonly SubjectMask[],
): Promise<SubjectMask | null> {
	let width = 0;
	let height = 0;
	for (const part of parts) {
		if (part.width > width) width = part.width;
		if (part.height > height) height = part.height;
	}
	if (width <= 0 || height <= 0) return null;
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.fillStyle = "black";
	context.fillRect(0, 0, width, height);
	context.globalCompositeOperation = "lighten";
	for (const part of parts) {
		const bitmap = await decode(part.uri);
		try {
			context.drawImage(bitmap, 0, 0, width, height);
		} finally {
			bitmap.close();
		}
	}
	const blob = await canvas.convertToBlob({ type: "image/png" });
	return { uri: URL.createObjectURL(blob), width, height };
}

async function maskBlobIoU(
	probs: Float32Array,
	side: number,
	maskUri: string,
): Promise<number> {
	const bitmap = await decode(maskUri);
	try {
		const canvas = new OffscreenCanvas(side, side);
		const context = canvas.getContext("2d");
		if (!context) return 0;
		context.drawImage(bitmap, 0, 0, side, side);
		const pixels = context.getImageData(0, 0, side, side).data;
		return maskAgreementIoU(probs, pixels, 4);
	} finally {
		bitmap.close();
	}
}

async function encodeSalientMask(
	probs: Float32Array,
	side: number,
	outputWidth: number,
	outputHeight: number,
): Promise<SubjectMask> {
	const pixels = new ImageData(side, side);
	const count = side * side;
	for (let i = 0; i < count; i++) {
		const value = Math.round(Math.min(1, Math.max(0, probs[i] ?? 0)) * 255);
		pixels.data[i * 4] = value;
		pixels.data[i * 4 + 1] = value;
		pixels.data[i * 4 + 2] = value;
		pixels.data[i * 4 + 3] = 255;
	}
	const rawCanvas = new OffscreenCanvas(side, side);
	const rawContext = rawCanvas.getContext("2d");
	if (!rawContext) throw new Error("Couldn't draw the mask");
	rawContext.putImageData(pixels, 0, 0);

	const outCanvas = new OffscreenCanvas(outputWidth, outputHeight);
	const outContext = outCanvas.getContext("2d");
	if (!outContext) throw new Error("Couldn't resize the mask");
	outContext.imageSmoothingEnabled = true;
	outContext.imageSmoothingQuality = "high";
	outContext.drawImage(rawCanvas, 0, 0, outputWidth, outputHeight);
	const blob = await outCanvas.convertToBlob({ type: "image/png" });
	return {
		uri: URL.createObjectURL(blob),
		width: outputWidth,
		height: outputHeight,
	};
}
