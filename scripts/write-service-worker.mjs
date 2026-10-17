// Run after the web export: writes dist/sw.js from service-worker.js, with
// the list of files the app needs to start, so it opens offline. The version
// changes whenever one of them does, which is how browsers find an update.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Loaded only when used: the service worker keeps them then.
const ON_USE = /^(mediapipe|tesseract|onnxruntime|mobile-sam|assets\/assets)\//;
// Served for the site, not the app.
const SITE_FILES = new Set([
	"og.jpg",
	"robots.txt",
	"sitemap.xml",
	"serve.json",
	"sw.js",
	"_sitemap.html",
	"+not-found.html",
]);

const files = readdirSync("dist", { recursive: true, withFileTypes: true })
	.filter((entry) => entry.isFile())
	.map((entry) => join(entry.parentPath, entry.name).slice("dist/".length))
	.filter(
		(file) =>
			!ON_USE.test(file) &&
			!SITE_FILES.has(file) &&
			!/(^|\/)\.|\.jpg$/.test(file),
	)
	.sort();

// A page is cached by the address it's served at (Vercel's `cleanUrls`), and
// every project shares the one exported for `[id]`.
const pathOf = (file) => {
	if (file === "index.html") return "/";
	if (!file.endsWith(".html")) return `/${file}`;
	return `/${file.slice(0, -".html".length).replaceAll("[id]", "_")}`;
};
const pages = files.filter((file) => file.endsWith(".html")).map(pathOf);

const hash = createHash("sha256");
for (const file of files)
	hash.update(file).update(readFileSync(join("dist", file)));
const version = hash.digest("hex").slice(0, 16);

writeFileSync(
	"dist/sw.js",
	`const VERSION = ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(files.map(pathOf))};
const PAGES = ${JSON.stringify(pages)};
${readFileSync("scripts/service-worker.js", "utf8")}`,
);
