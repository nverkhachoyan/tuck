// Copies the WebAssembly and models the web app loads from node_modules into
// public/, so the app serves them itself rather than fetching them from CDNs.

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const publicFolder = join(process.cwd(), "public");

function copy(source, destination) {
	const path = join(publicFolder, destination);
	mkdirSync(join(path, ".."), { recursive: true });
	copyFileSync(source, path);
}

copy(
	require.resolve("canvaskit-wasm/bin/full/canvaskit.wasm", {
		paths: [require.resolve("@shopify/react-native-skia")],
	}),
	"canvaskit.wasm",
);

// Text detection. The worker picks one core by what the browser supports;
// only the LSTM engine's are needed, as the app never asks for the legacy one.
copy(
	require.resolve("tesseract.js/dist/worker.min.js"),
	"tesseract/worker.min.js",
);
const tesseractCore = { paths: [require.resolve("tesseract.js")] };
for (const core of ["", "-simd", "-relaxedsimd"]) {
	const file = `tesseract-core${core}-lstm.wasm.js`;
	copy(
		require.resolve(`tesseract.js-core/${file}`, tesseractCore),
		`tesseract/${file}`,
	);
}
copy(
	require.resolve("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"),
	"tesseract/eng.traineddata.gz",
);

// Face detection. The app loads the library's script build itself, and
// FilesetResolver picks the SIMD build of its WebAssembly when the browser
// has SIMD. The model isn't published to npm, so it's kept in the repository:
// version 1 of blaze_face_full_range from Google's MediaPipe models.
const mediaPipeFiles = ["vision_bundle.js"];
for (const build of ["", "_nosimd"]) {
	mediaPipeFiles.push(
		`vision_wasm${build}_internal.js`,
		`vision_wasm${build}_internal.wasm`,
	);
}
for (const file of mediaPipeFiles) {
	copy(require.resolve(`@mediapipe/tasks-vision/${file}`), `mediapipe/${file}`);
}
// The same goes for background removal's model, version 1 of MagicTouch.
for (const model of ["blaze_face_full_range.tflite", "magic_touch.tflite"]) {
	copy(`modules/image-analysis/models/${model}`, `mediapipe/${model}`);
}

// Selecting objects: ONNX Runtime's WebGPU build, whose WebAssembly runs
// MobileSAM where the browser has no WebGPU, in a worker of the module's.
// The models are an ONNX export of MobileSAM, from Acly/MobileSAM on
// Hugging Face. The runtime's package exports none of these files.
const onnxRuntime = dirname(require.resolve("onnxruntime-web"));
for (const file of [
	"ort.webgpu.bundle.min.mjs",
	"ort-wasm-simd-threaded.asyncify.wasm",
]) {
	copy(join(onnxRuntime, file), `onnxruntime/${file}`);
}
for (const model of [
	"mobile_sam_image_encoder.onnx",
	"sam_mask_decoder_multi.onnx",
]) {
	copy(`modules/image-analysis/models/${model}`, `mobile-sam/${model}`);
}
copy("modules/image-analysis/src/mobileSamWorker.js", "mobile-sam-worker.js");
