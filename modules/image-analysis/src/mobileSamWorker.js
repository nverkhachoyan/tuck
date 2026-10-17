// Segment Anything (MobileSAM) in a worker, for selecting any object under a
// tap on web: `objectSelection.web.ts` starts it, and `copy-web-assets.mjs`
// serves it as /mobile-sam-worker.js. It encodes one image at a time, once,
// then answers each tap from that encoding.
//
// Messages in: { id, type: "encode", image } with an ImageBitmap already
// sized for the encoder (1024 pixels on its longer side, at most), and
// { id, type: "select", x, y } in its pixels. Out: { id, error } or
// { id, masks, likeliest } with each mask a grayscale PNG blob, smallest
// first, and the index of the one the model thinks likeliest.

import * as ort from "/onnxruntime/ort.webgpu.bundle.min.mjs";

// Only the WebAssembly's address: a folder would have the bundle fetch the
// glue it already holds.
ort.env.wasm.wasmPaths = {
	wasm: "/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
};
// The site isn't cross-origin isolated, so WebAssembly gets no threads.
ort.env.wasm.numThreads = 1;

// WebGPU where the browser has it, which encodes about three times faster.
const PROVIDERS = ["webgpu", "wasm"];
// Masks whose areas are this close to a smaller one's add nothing to grow to.
const SAME_AREA = 0.05;

let sessions = null;
let encoded = null;

function load() {
	// One after the other: WebGPU sessions can't be made at the same time.
	sessions ??= (async () => [
		await ort.InferenceSession.create(
			"/mobile-sam/mobile_sam_image_encoder.onnx",
			{ executionProviders: PROVIDERS },
		),
		await ort.InferenceSession.create(
			"/mobile-sam/sam_mask_decoder_multi.onnx",
			{ executionProviders: PROVIDERS },
		),
	])().catch((error) => {
		sessions = null;
		throw error;
	});
	return sessions;
}

// The encoder takes the image as it is, HWC with values 0–255, and
// normalizes and pads it itself.
async function encode(image) {
	const { width, height } = image;
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	context.drawImage(image, 0, 0);
	image.close();
	const pixels = context.getImageData(0, 0, width, height).data;
	const input = new Float32Array(width * height * 3);
	for (let i = 0, j = 0; i < pixels.length; i += 4) {
		input[j++] = pixels[i];
		input[j++] = pixels[i + 1];
		input[j++] = pixels[i + 2];
	}
	const [encoder] = await load();
	encoded?.embeddings.dispose();
	encoded = null;
	const output = await encoder.run({
		input_image: new ort.Tensor("float32", input, [height, width, 3]),
	});
	encoded = { embeddings: output.image_embeddings, width, height };
	// WebGPU's first run of the decoder takes a second to set up, which
	// would otherwise come with the first tap.
	disposeAll(await decode(width / 2, height / 2));
}

function disposeAll(output) {
	for (const tensor of Object.values(output)) tensor.dispose();
}

async function decode(x, y) {
	if (!encoded) throw new Error("No image is encoded");
	const { embeddings, width, height } = encoded;
	const [, decoder] = await load();
	return decoder.run({
		image_embeddings: embeddings,
		// The point, and the padding point SAM's decoder expects without a box.
		point_coords: new ort.Tensor(
			"float32",
			new Float32Array([x, y, 0, 0]),
			[1, 2, 2],
		),
		point_labels: new ort.Tensor("float32", new Float32Array([1, -1]), [1, 2]),
		mask_input: new ort.Tensor(
			"float32",
			new Float32Array(256 * 256),
			[1, 1, 256, 256],
		),
		has_mask_input: new ort.Tensor("float32", new Float32Array([0]), [1]),
		orig_im_size: new ort.Tensor(
			"float32",
			new Float32Array([height, width]),
			[2],
		),
	});
}

// The decoder's three masks for a point, from a part to the whole: its
// first output is the single mask it gives when told not to guess, which
// the other three cover.
async function select(x, y) {
	const output = await decode(x, y);
	const { width, height } = encoded;
	const logits = output.masks.data;
	const scores = output.iou_predictions.data;
	const size = width * height;
	const masks = [];
	for (let index = 1; index < output.masks.dims[1]; index++) {
		const values = new Uint8ClampedArray(size);
		let area = 0;
		for (let i = 0; i < size; i++) {
			const logit = logits[index * size + i];
			if (logit > 0) area++;
			values[i] = 255 / (1 + Math.exp(-logit));
		}
		if (area > 0) masks.push({ values, area, score: scores[index] });
	}
	disposeAll(output);
	masks.sort((a, b) => a.area - b.area);
	const distinct = masks.filter(
		(mask, i) => i === 0 || mask.area > masks[i - 1].area * (1 + SAME_AREA),
	);
	let likeliest = 0;
	distinct.forEach((mask, i) => {
		if (mask.score > distinct[likeliest].score) likeliest = i;
	});
	return {
		masks: await Promise.all(
			distinct.map(({ values }) => encodePng(values, width, height)),
		),
		likeliest,
	};
}

function encodePng(values, width, height) {
	const pixels = new ImageData(width, height);
	for (let i = 0; i < values.length; i++) {
		pixels.data[i * 4] = values[i];
		pixels.data[i * 4 + 1] = values[i];
		pixels.data[i * 4 + 2] = values[i];
		pixels.data[i * 4 + 3] = 255;
	}
	const canvas = new OffscreenCanvas(width, height);
	canvas.getContext("2d").putImageData(pixels, 0, 0);
	return canvas.convertToBlob({ type: "image/png" });
}

// One message at a time, so a tap waits for the encoding before it.
let queue = Promise.resolve();

self.addEventListener("message", ({ data }) => {
	queue = queue.then(async () => {
		try {
			if (data.type === "encode") {
				await encode(data.image);
				self.postMessage({ id: data.id });
			} else if (data.type === "select") {
				self.postMessage({ id: data.id, ...(await select(data.x, data.y)) });
			}
		} catch (error) {
			self.postMessage({ id: data.id, error: String(error?.message ?? error) });
		}
	});
});
