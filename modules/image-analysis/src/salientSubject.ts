import type { SubjectMask } from "./ImageAnalysis.types";
import { decode } from "./mediaPipe";
import { evaluateSalientMask } from "./salientMask";

const INPUT_SIDE = 320;
// Aspect-preserving mask resolution: smooth upscaling from 320×320 without
// storing a giant PNG, matching `mediaPipeSubject.ts`.
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
 * A mask of the salient foreground subjects in the image at `uri`, using
 * U²-Net-p in an ONNX Runtime Web worker. Returns a grayscale PNG's blob URL,
 * white where the subject is, or null when no plausible subject is found.
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
	return encodeSalientMask(probs, side, outputWidth, outputHeight);
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
