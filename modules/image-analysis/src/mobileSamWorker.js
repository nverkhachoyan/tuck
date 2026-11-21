// Segment Anything (MobileSAM) in a worker, for selecting any object under a
// tap on web: `objectSelection.web.ts` starts it, and `copy-web-assets.mjs`
// serves it as /mobile-sam-worker.js. It encodes one image at a time, once,
// then answers each tap from that encoding.
//
// Messages in: { id, type: "encode", image } with an ImageBitmap already
// sized for the encoder (1024 pixels on its longer side, at most),
// { id, type: "select", x, y } or { id, type: "select", box: [left, top,
// right, bottom] } in its pixels, and { id, type: "selectCrop", image, box,
// outputWidth, outputHeight, paste } to encode and decode a crop without
// replacing the whole-image encoding. Out: { id, error } or { id, masks,
// likeliest } with each mask a grayscale PNG blob, smallest first, and the
// index of the one the model thinks likeliest (a box gets one mask).

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
// How much steeper than its sigmoid a mask's coverage rises across its edge.
// A box's mask can be unsure all through (logits under 3 inside), and at its
// sigmoid an object taken out after being added left a ghost of itself.
const SHARPNESS = 8;

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

// The encoder takes a fixed square (so Core ML can run it on iOS), HWC with
// values 0–255, and normalizes it itself. The image goes at its top left,
// padded with ImageNet's mean, which normalizes to nothing, as SAM pads.
const SIDE = 1024;
const MEAN = [123.675, 116.28, 103.53];

async function runEncoder(image) {
	const { width, height } = image;
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	context.drawImage(image, 0, 0);
	image.close();
	const pixels = context.getImageData(0, 0, width, height).data;
	const input = new Float32Array(SIDE * SIDE * 3);
	for (let i = 0; i < input.length; i += 3) input.set(MEAN, i);
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			const from = (row * width + column) * 4;
			const to = (row * SIDE + column) * 3;
			input[to] = pixels[from];
			input[to + 1] = pixels[from + 1];
			input[to + 2] = pixels[from + 2];
		}
	}
	const [encoder] = await load();
	const tensor = new ort.Tensor("float32", input, [SIDE, SIDE, 3]);
	try {
		const output = await encoder.run({ input_image: tensor });
		return { embeddings: output.image_embeddings, width, height };
	} finally {
		tensor.dispose();
	}
}

async function encode(image) {
	encoded?.embeddings.dispose();
	encoded = null;
	encoded = await runEncoder(image);
	// WebGPU's first run of the decoder takes a second to set up, which
	// would otherwise come with the first tap.
	disposeAll(await decode(pointPrompt(encoded.width / 2, encoded.height / 2)));
}

// A point, and the padding point SAM's decoder expects without a box.
function pointPrompt(x, y) {
	return { coords: [x, y, 0, 0], labels: [1, -1] };
}

// A box, as its top left and bottom right corners, labelled as SAM's are.
function boxPrompt([left, top, right, bottom]) {
	return { coords: [left, top, right, bottom], labels: [2, 3] };
}

function disposeAll(output) {
	for (const tensor of Object.values(output)) tensor.dispose();
}

async function decodeWith(embeddings, width, height, { coords, labels }) {
	const [, decoder] = await load();
	const pointCoords = new ort.Tensor("float32", new Float32Array(coords), [
		1,
		labels.length,
		2,
	]);
	const pointLabels = new ort.Tensor("float32", new Float32Array(labels), [
		1,
		labels.length,
	]);
	const maskInput = new ort.Tensor(
		"float32",
		new Float32Array(256 * 256),
		[1, 1, 256, 256],
	);
	const hasMaskInput = new ort.Tensor("float32", new Float32Array([0]), [1]);
	const origImSize = new ort.Tensor(
		"float32",
		new Float32Array([height, width]),
		[2],
	);
	try {
		return await decoder.run({
			image_embeddings: embeddings,
			point_coords: pointCoords,
			point_labels: pointLabels,
			mask_input: maskInput,
			has_mask_input: hasMaskInput,
			orig_im_size: origImSize,
		});
	} finally {
		pointCoords.dispose();
		pointLabels.dispose();
		maskInput.dispose();
		hasMaskInput.dispose();
		origImSize.dispose();
	}
}

async function decode(prompt) {
	if (!encoded) throw new Error("No image is encoded");
	return decodeWith(encoded.embeddings, encoded.width, encoded.height, prompt);
}

function coverageMask(logits, offset, size) {
	const values = new Uint8ClampedArray(size);
	let area = 0;
	for (let i = 0; i < size; i++) {
		const logit = logits[offset + i];
		if (logit > 0) area++;
		values[i] = 255 / (1 + Math.exp(-SHARPNESS * logit));
	}
	return { values, area };
}

// The decoder's three masks for a point, from a part to the whole: its
// first output is the single mask it gives when told not to guess, which
// the other three cover. A box says which object it means, so it gets that
// first output alone.
async function select(data) {
	const box = data.box !== undefined;
	const output = await decode(
		box ? boxPrompt(data.box) : pointPrompt(data.x, data.y),
	);
	const { width, height } = encoded;
	const logits = output.masks.data;
	const scores = output.iou_predictions.data;
	const size = width * height;
	const masks = [];
	const outputs = box
		? [0]
		: Array.from({ length: output.masks.dims[1] - 1 }, (_, i) => i + 1);
	for (const index of outputs) {
		const { values, area } = coverageMask(logits, index * size, size);
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

async function selectCrop({ image, box, outputWidth, outputHeight, paste }) {
	const crop = await runEncoder(image);
	let output;
	try {
		output = await decodeWith(
			crop.embeddings,
			paste.width,
			paste.height,
			boxPrompt(box),
		);
		const size = paste.width * paste.height;
		const { values, area } = coverageMask(output.masks.data, 0, size);
		if (area === 0) return { masks: [], likeliest: 0 };
		const full = new Uint8ClampedArray(outputWidth * outputHeight);
		for (let row = 0; row < paste.height; row++) {
			full.set(
				values.subarray(row * paste.width, (row + 1) * paste.width),
				(paste.y + row) * outputWidth + paste.x,
			);
		}
		return {
			masks: [await encodePng(full, outputWidth, outputHeight)],
			likeliest: 0,
		};
	} finally {
		if (output) disposeAll(output);
		crop.embeddings.dispose();
	}
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
				self.postMessage({ id: data.id, ...(await select(data)) });
			} else if (data.type === "selectCrop") {
				self.postMessage({ id: data.id, ...(await selectCrop(data)) });
			}
		} catch (error) {
			self.postMessage({ id: data.id, error: String(error?.message ?? error) });
		}
	});
});
