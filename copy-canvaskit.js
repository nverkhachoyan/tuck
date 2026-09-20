// This script is used to copy canvaskit.wasm from node_modules to public folder

const fs = require("node:fs");
const path = require("node:path");

const publicFolder = path.join(process.cwd(), "public");
fs.mkdirSync(publicFolder, { recursive: true });

const wasmSrc = require.resolve("canvaskit-wasm/bin/full/canvaskit.wasm", {
	paths: [require.resolve("@shopify/react-native-skia")],
});

const wasmDest = path.join(publicFolder, "canvaskit.wasm");
fs.copyFileSync(wasmSrc, wasmDest);
