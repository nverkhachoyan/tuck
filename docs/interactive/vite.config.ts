import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const platform = fileURLToPath(new URL("src/platform/", import.meta.url));
// CanvasKit is React Native Skia's dependency, not the app's, so it's found
// from Skia's folder, as `scripts/copy-web-assets.mjs` finds it.
const require = createRequire(import.meta.url);
const canvasKitWasm = require.resolve(
	"canvaskit-wasm/bin/full/canvaskit.wasm",
	{
		paths: [require.resolve("react-native-skia", { paths: [repoRoot] })],
	},
);

/**
 * `@expo-google-fonts/<font>/<weight>` exports its file with a `require` of
 * a `.ttf`, which only Metro understands. Here it exports the file's URL,
 * which is what `render/fonts.ts` hands Skia in the end.
 */
function expoGoogleFonts(): Plugin {
	const prefix = "\0expo-google-font:";
	return {
		name: "expo-google-fonts",
		enforce: "pre",
		resolveId(source) {
			const match = /^@expo-google-fonts\/([^/]+)\/([^/]+)$/.exec(source);
			return match
				? `${prefix}${repoRoot}node_modules/@expo-google-fonts/${match[1]}/${match[2]}`
				: null;
		},
		load(id) {
			if (!id.startsWith(prefix)) return null;
			const folder = id.slice(prefix.length);
			const file = readdirSync(folder).find((name) => name.endsWith(".ttf"));
			if (!file) throw new Error(`No font file in ${folder}`);
			return `import url from "${folder}/${file}?url";\nexport const ${file.replace(".ttf", "")} = url;\n`;
		},
	};
}

// Metro's platform files, which the app's code and its dependencies rely on:
// `preferenceStore.web.ts` over `preferenceStore.ts`, and React Native Skia's
// web views over its native ones.
const webFirst = [
	".web.tsx",
	".web.ts",
	".web.jsx",
	".web.js",
	".tsx",
	".ts",
	".jsx",
	".js",
	".mjs",
	".json",
];

export default defineConfig({
	plugins: [react(), expoGoogleFonts()],
	resolve: {
		alias: [
			// Lessons import the app's real modules, so the docs break when they
			// change instead of quietly going stale.
			{ find: /^@model\//, replacement: `${repoRoot}src/model/` },
			{ find: /^@src\//, replacement: `${repoRoot}src/` },
			// The app's own alias, which its `render/` code imports through.
			{ find: /^@\//, replacement: `${repoRoot}src/` },
			// React Native Skia's web build runs on CanvasKit and React Native
			// Web, as the app's web build does. It looks for Reanimated, and for
			// React Native's asset registry, only to use them if they're there.
			{ find: /^react-native$/, replacement: "react-native-web" },
			{
				find: /^react-native\/(asset-registry|Libraries\/Image\/AssetRegistry)$/,
				replacement: `${platform}assetRegistry.ts`,
			},
			{
				find: /^react-native-reanimated(\/.*)?$/,
				replacement: `${platform}reanimated.ts`,
			},
			{ find: /^expo-asset$/, replacement: `${platform}expoAsset.ts` },
			{ find: /^expo-font$/, replacement: `${platform}expoFont.ts` },
			{
				find: /^canvaskit-wasm\/bin\/full\/canvaskit\.wasm/,
				replacement: canvasKitWasm,
			},
		],
		extensions: webFirst,
		// The app's dependencies come from the repo's own `node_modules`, at the
		// versions the app runs; they must share the docs' one React.
		dedupe: ["react", "react-dom"],
	},
	optimizeDeps: {
		rolldownOptions: { resolve: { extensions: webFirst } },
	},
	define: {
		__DEV__: "true",
		global: "globalThis",
	},
	server: {
		port: 5180,
		fs: { allow: [repoRoot] },
	},
});
