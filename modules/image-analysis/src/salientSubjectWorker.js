// Salient-object segmentation (U²-Net-p) in a worker, for one-shot Remove BG
// and Cut → Subjects on web: `salientSubject.ts` starts it, and
// `copy-web-assets.mjs` serves it as /salient-subject-worker.js.
//
// Messages in: { id, type: "segment", image } with an ImageBitmap already
// resized to SIDE×SIDE.
// Out: { id, error } or { id, probs, side } with probs a transferred
// Float32Array of SIDE×SIDE foreground probabilities in [0, 1].

import * as ort from "/onnxruntime/ort.webgpu.bundle.min.mjs";

ort.env.wasm.wasmPaths = {
	wasm: "/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
};
// The site isn't cross-origin isolated, so WebAssembly gets no threads.
ort.env.wasm.numThreads = 1;

const PROVIDERS = ["webgpu", "wasm"];
const SIDE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise = null;

function load() {
	sessionPromise ??= ort.InferenceSession.create(
		"/salient-subject/u2netp.onnx",
		{ executionProviders: PROVIDERS },
	).catch((error) => {
		sessionPromise = null;
		throw error;
	});
	return sessionPromise;
}

async function segment(image) {
	const canvas = new OffscreenCanvas(SIDE, SIDE);
	const context = canvas.getContext("2d");
	context.drawImage(image, 0, 0, SIDE, SIDE);
	image.close();
	const pixels = context.getImageData(0, 0, SIDE, SIDE).data;

	let maxChannel = 0;
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i] > maxChannel) maxChannel = pixels[i];
		if (pixels[i + 1] > maxChannel) maxChannel = pixels[i + 1];
		if (pixels[i + 2] > maxChannel) maxChannel = pixels[i + 2];
	}
	const invMax = maxChannel > 0 ? 1 / maxChannel : 1 / 255;

	const plane = SIDE * SIDE;
	const input = new Float32Array(3 * plane);
	for (let i = 0; i < plane; i++) {
		const r = pixels[i * 4] * invMax;
		const g = pixels[i * 4 + 1] * invMax;
		const b = pixels[i * 4 + 2] * invMax;
		input[i] = (r - MEAN[0]) / STD[0];
		input[plane + i] = (g - MEAN[1]) / STD[1];
		input[2 * plane + i] = (b - MEAN[2]) / STD[2];
	}

	const session = await load();
	const tensor = new ort.Tensor("float32", input, [1, 3, SIDE, SIDE]);
	let output;
	try {
		output = await session.run({ [session.inputNames[0]]: tensor });
	} finally {
		tensor.dispose();
	}

	try {
		// Copy out before disposing the output tensors so the buffer can transfer.
		const probs = new Float32Array(output[session.outputNames[0]].data);
		return { probs, side: SIDE };
	} finally {
		for (const key of session.outputNames) output[key].dispose();
	}
}

let queue = Promise.resolve();

self.addEventListener("message", ({ data }) => {
	queue = queue.then(async () => {
		try {
			if (data.type === "segment") {
				const { probs, side } = await segment(data.image);
				self.postMessage({ id: data.id, probs, side }, [probs.buffer]);
			}
		} catch (error) {
			self.postMessage({ id: data.id, error: String(error?.message ?? error) });
		}
	});
});
