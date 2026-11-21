// Expo's runtime first: among other things it installs the loader Metro's
// dynamic `import()` below needs on web.
import "expo";
import { registerServiceWorker } from "@/platform/serviceWorker";
import { preloadSkia } from "@/platform/skia";

// The export's pages are rendered ahead of time, and the browser renders them
// afresh rather than hydrating them: the server has no palette preference, so
// its HTML is in the day palette, whose class names React would keep in the
// night one, and no icon font, so its icons are empty text, which fails
// hydration in either.
(globalThis as { __EXPO_ROUTER_HYDRATE__?: boolean }).__EXPO_ROUTER_HYDRATE__ =
	false;

// `+html.tsx` hides the day-palette prerender from a night-palette page until
// something replaces it: the app, its error screen, or the load failure.
const root = document.getElementById("root");
if (root) {
	new MutationObserver((_, observer) => {
		root.dataset.rendered = "";
		observer.disconnect();
	}).observe(root, { childList: true });
}

// On web, Skia's module binds to CanvasKit (its WASM build) the moment it's
// first evaluated. Pages that draw nothing start at once while CanvasKit loads
// beside them; the editor, export, and thumbnail rendering dynamically import
// Skia only after `loadSkia()` resolves.
preloadSkia();
// @ts-expect-error: untyped, and imported only for its side effect.
import("expo-router/entry").then(registerServiceWorker, showLoadFailure);

/**
 * Without the router, React never runs, so the page says so with the markup
 * `+html.tsx` leaves in a template.
 */
function showLoadFailure(error: unknown) {
	console.error(error);
	const template = document.getElementById("load-failure");
	const root = document.getElementById("root");
	if (!(template instanceof HTMLTemplateElement) || !root) return;
	root.replaceChildren(template.content.cloneNode(true));
	root
		.querySelector("button")
		?.addEventListener("click", () => window.location.reload());
}
