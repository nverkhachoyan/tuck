import {
	ScrollViewStyleReset,
	useServerDocumentContext,
} from "expo-router/html";
import type { ReactNode } from "react";

// The day and night palettes' `background` and `textPrimary` (`theme.ts`):
// this page is rendered ahead of time, before the browser says which the app
// will use.
const dayBackground = "#FFFFFF";
const nightBackground = "#17181B";
const dayInk = "#000000";
const nightInk = "#F3F3F1";

// What a link to the site shows in a chat or a post. The image must be an
// absolute URL; it's made from `store/source/og.html`.
const SITE_URL = "https://www.tuck.tools";
const SITE_TITLE = "Tuck: Photo Markup";
const SITE_DESCRIPTION =
	"Blur, redact, caption, and mark up photos and screenshots in your browser. Every edit happens on your device: no account, no uploads, no watermark.";
const PREVIEW_IMAGE = { url: `${SITE_URL}/og.jpg`, width: 1200, height: 630 };

// The night palette's page, under `scope`: the system's when Settings
// leaves it to the system, or forced by the attribute below.
const nightRules = (scope: string) =>
	`${scope}, ${scope} body, ${scope} #root { background-color: ${nightBackground}; color-scheme: dark; } ${scope} :focus-visible { outline-color: ${nightInk}; }`;

// Before anything paints, applies a palette chosen in Settings (`theme.ts`
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
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
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
				{/* The palette's page, and keyboard focus in its ink, like every
				    other control, rather than the browser's blue, which the app
				    keeps for marks over the photo. */}
				<style>{`html, body, #root { background-color: ${dayBackground}; color-scheme: light; } :focus-visible { outline: 2px solid ${dayInk}; outline-offset: 2px; } @media (prefers-color-scheme: dark) { ${nightRules('html:not([data-theme="light"])')} } ${nightRules('html[data-theme="dark"]')}`}</style>
				<meta name="description" content={SITE_DESCRIPTION} />
				<meta property="og:type" content="website" />
				<meta property="og:site_name" content="Tuck" />
				<meta property="og:title" content={SITE_TITLE} />
				<meta property="og:description" content={SITE_DESCRIPTION} />
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
				<meta name="twitter:title" content={SITE_TITLE} />
				<meta name="twitter:description" content={SITE_DESCRIPTION} />
				<meta name="twitter:image" content={PREVIEW_IMAGE.url} />
				<ScrollViewStyleReset />
				{headNodes}
			</head>
			<body {...bodyAttributes}>
				{children}
				{bodyNodes}
			</body>
		</html>
	);
}
