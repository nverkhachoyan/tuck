// The web app's service worker, which lets Tuck open without a connection.
// `write-service-worker.mjs` writes it to dist/sw.js after the export, with
// VERSION, PRECACHE (what the app needs to start), and PAGES above it.

const VERSION_PREFIX = "tuck-version-";
const CURRENT = VERSION_PREFIX + VERSION;
// Hashed names never change, so these needn't be checked with the server.
const HASHED = /^\/(_expo\/static|assets)\//;
// The detection engines and models, too big to fetch before they're used.
// Their names stay the same across library versions, so they're kept with
// the version of the app that fetched them.
const ENGINES = /^\/(mediapipe|tesseract)\//;
// Stickers, which only the sheet loads: kept from their first use, across
// versions, under names with content hashes.
const STICKERS_CACHE = "tuck-stickers";
const STICKERS = /^\/assets\/assets\/stickers\//;

const fetchFresh = (path) =>
	fetch(path, HASHED.test(path) ? {} : { cache: "no-cache" });

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CURRENT).then((cache) =>
			Promise.all(
				PRECACHE.map(async (path) => {
					const response = await fetchFresh(path);
					// Vercel may answer the 404 page with its status.
					if (!response.ok && path !== "/404") {
						throw new Error(`${path}: ${response.status}`);
					}
					await cache.put(path, response);
				}),
			),
		),
	);
});

// Keeps the version before this one too, for tabs still running it: their
// code loads chunks by the old names, which the server no longer has.
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((names) => {
			// Cache names are listed in the order they were made.
			const versions = names.filter((name) => name.startsWith(VERSION_PREFIX));
			const previous = versions[versions.indexOf(CURRENT) - 1];
			return Promise.all(
				versions
					.filter((name) => name !== CURRENT && name !== previous)
					.map((name) => caches.delete(name)),
			);
		}),
	);
});

// The page asks once someone chooses to reload into the new version.
self.addEventListener("message", (event) => {
	if (event.data === "skipWaiting") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== self.location.origin) return;
	const path = url.pathname;
	if (request.mode === "navigate") {
		event.respondWith(page(request, path));
	} else if (ENGINES.test(path)) {
		event.respondWith(keptOnUse(CURRENT, path));
	} else if (STICKERS.test(path)) {
		event.respondWith(keptOnUse(STICKERS_CACHE, path));
	} else {
		event.respondWith(
			fromCache(path).then((cached) => cached ?? fetch(request)),
		);
	}
});

// This version's copy first: a file without a hash in its name, like
// canvaskit.wasm, is in the previous version's cache too, which
// `caches.match` would search first, as the older one. Then any version's,
// for a tab still running the previous one.
async function fromCache(path) {
	const current = await caches.open(CURRENT);
	return (
		(await current.match(path, { ignoreVary: true })) ??
		(await caches.match(path, { ignoreVary: true }))
	);
}

// The network's page while online, so a deploy shows at once; offline, the
// page from this version, every project sharing one.
async function page(request, path) {
	try {
		return await fetch(request);
	} catch (error) {
		const cached = await fromCache(pageFor(path));
		if (cached) return cached;
		throw error;
	}
}

function pageFor(path) {
	const trimmed = path.length > 1 ? path.replace(/\/$/, "") : path;
	if (PAGES.includes(trimmed)) return trimmed;
	if (/^\/projects\/[^/]+\/export$/.test(trimmed)) return "/projects/_/export";
	if (/^\/projects\/[^/]+$/.test(trimmed)) return "/projects/_";
	return "/404";
}

async function keptOnUse(cacheName, path) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(path, { ignoreVary: true });
	if (cached) return cached;
	const response = await fetchFresh(path);
	if (response.ok) await cache.put(path, response.clone());
	return response;
}
