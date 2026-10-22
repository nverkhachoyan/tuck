import {
	ScrollViewStyleReset,
	useServerDocumentContext,
} from "expo-router/html";
import type { ReactNode } from "react";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

// The day and night palettes' `background` and `textPrimary` (`ui/theme.ts`):
// this page is rendered ahead of time, before the browser says which the app
// will use.
const dayBackground = "#FFFFFF";
const nightBackground = "#17181B";
const dayInk = "#000000";
const nightInk = "#F3F3F1";

// The picture a link to any page shows in a chat or a post; each page's
// title and description come from `PageHead`. The image must be an absolute
// URL; it's made from `docs/store-listing/source/og.html`.
const PREVIEW_IMAGE = { url: `${SITE_URL}/og.jpg`, width: 1200, height: 630 };

const palette = (background: string, ink: string, scheme: string) =>
	`--background: ${background}; --ink: ${ink}; color-scheme: ${scheme};`;

// The page in the day palette, or the night one: the system's when Settings
// leaves it to the system, or forced by the attribute the script below sets.
// Keyboard focus is in the palette's ink, like every other control, rather
// than the browser's blue, which the app keeps for marks over the photo.
const pageStyle = `html { ${palette(dayBackground, dayInk, "light")} }
@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) { ${palette(nightBackground, nightInk, "dark")} } }
html[data-theme="dark"] { ${palette(nightBackground, nightInk, "dark")} }
html, body, #root { background-color: var(--background); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.fallback { position: fixed; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; background-color: var(--background); color: var(--ink); font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
.fallback h1 { margin: 0; font-size: 17px; font-weight: 600; }
.fallback p { margin: 0; max-width: 340px; opacity: 0.7; }
.fallback a { color: inherit; }
.fallback button { margin-top: 12px; padding: 12px 24px; border: 0; border-radius: 12px; background-color: var(--ink); color: var(--background); font: inherit; font-weight: 600; cursor: pointer; }`;

// Shown in place of the app when it can't start: without JavaScript, or, from
// `index.web.ts`'s template, when CanvasKit or the app's code can't load.
function Fallback({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="fallback" role="alert">
			<h1>{title}</h1>
			{children}
			<p>
				Still stuck? Email{" "}
				<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
			</p>
		</div>
	);
}

// Before anything paints, applies a palette chosen in Settings (`ui/theme.ts`
// reads the same preference) to the page and the browser's chrome.
const applySavedTheme = `try {
	var theme = JSON.parse(localStorage.getItem("tuck:theme"));
	if (theme === "light" || theme === "dark") {
		document.documentElement.setAttribute("data-theme", theme);
		document.querySelector('meta[name="color-scheme"]').content = theme;
		document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
			meta.content = theme === "dark" ? "${nightBackground}" : "${dayBackground}";
		});
	}
} catch (error) {}`;

/**
 * The browser paints the space outside React Native Web's root. Make that
 * surface match the app, including below Safari's translucent browser chrome.
 */
export default function Root({ children }: { children: ReactNode }) {
	const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } =
		useServerDocumentContext();

	return (
		<html lang="en" {...htmlAttributes}>
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, viewport-fit=cover"
				/>
				<meta
					name="theme-color"
					media="(prefers-color-scheme: light)"
					content={dayBackground}
				/>
				<meta
					name="theme-color"
					media="(prefers-color-scheme: dark)"
					content={nightBackground}
				/>
				<meta name="color-scheme" content="light dark" />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, which must run before the first paint. */}
				<script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
				<style>{pageStyle}</style>
				{/* Nothing works until CanvasKit has loaded, and `index.web.ts` only
				    asks for it once the scripts have downloaded and run. */}
				<link
					rel="preload"
					href="/canvaskit.wasm"
					as="fetch"
					type="application/wasm"
					crossOrigin="anonymous"
				/>
				<link rel="manifest" href="/manifest.webmanifest" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				<meta name="apple-mobile-web-app-title" content="Tuck" />
				<meta property="og:type" content="website" />
				<meta property="og:site_name" content="Tuck" />
				<meta property="og:image" content={PREVIEW_IMAGE.url} />
				<meta property="og:image:width" content={String(PREVIEW_IMAGE.width)} />
				<meta
					property="og:image:height"
					content={String(PREVIEW_IMAGE.height)}
				/>
				<meta
					property="og:image:alt"
					content="The Tuck wordmark beside the editor redacting a chat and captioning a picture."
				/>
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:image" content={PREVIEW_IMAGE.url} />
				<ScrollViewStyleReset />
				{headNodes}
			</head>
			<body {...bodyAttributes}>
				{children}
				<noscript>
					<Fallback title="Tuck needs JavaScript">
						<p>
							Turn on JavaScript in your browser's settings to edit photos with
							Tuck.
						</p>
					</Fallback>
				</noscript>
				<template id="load-failure">
					<Fallback title="Tuck couldn't start">
						<p>
							Part of it didn't load. Check your connection and try again. Tuck
							needs a recent version of Chrome, Edge, Firefox, or Safari.
						</p>
						<button type="button">Try Again</button>
					</Fallback>
				</template>
				{bodyNodes}
			</body>
		</html>
	);
}
