// Expo's runtime first: among other things it installs the loader Metro's
// dynamic `import()` below needs on web.
import "expo";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { registerServiceWorker } from "@/lib/serviceWorker";

// The export's pages are rendered ahead of time, and the browser renders them
// afresh rather than hydrating them: the server has no palette preference, so
// its HTML is in the day palette, whose class names React would keep in the
// night one, and no icon font, so its icons are empty text, which fails
// hydration in either.
(globalThis as { __EXPO_ROUTER_HYDRATE__?: boolean }).__EXPO_ROUTER_HYDRATE__ =
	false;

// On web, Skia's module binds to CanvasKit (its WASM build) the moment it's
// first evaluated, and Expo Router evaluates every route at startup. So the
// app's code may only load once CanvasKit has: nothing may import Skia above
// this line, and the router is imported dynamically.
LoadSkiaWeb({ locateFile: (file) => `/${file}` })
	.then(
		// @ts-expect-error: untyped, and imported only for its side effect.
		() => import("expo-router/entry"),
	)
	.then(registerServiceWorker, showLoadFailure);

/**
 * Without CanvasKit or the router, React never runs, so the page says so
 * with the markup `+html.tsx` leaves in a template.
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
