import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: {
		// Lessons import the app's real modules, so the docs break when they
		// change instead of quietly going stale.
		alias: { "@model": `${repoRoot}src/model` },
	},
	server: {
		port: 5180,
		fs: { allow: [repoRoot] },
	},
});
