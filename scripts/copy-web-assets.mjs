// Copies the WebAssembly and models the web app loads from node_modules into
// public/, so the app serves them itself rather than fetching them from CDNs.

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

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
