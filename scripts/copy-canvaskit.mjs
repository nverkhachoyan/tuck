// This script is used to copy canvaskit.wasm from node_modules to public folder

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const publicFolder = join(process.cwd(), "public");
mkdirSync(publicFolder, { recursive: true });

const wasmSrc = require.resolve("canvaskit-wasm/bin/full/canvaskit.wasm", {
	paths: [require.resolve("@shopify/react-native-skia")],
});

const wasmDest = join(publicFolder, "canvaskit.wasm");
copyFileSync(wasmSrc, wasmDest);
