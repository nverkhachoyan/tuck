import {
	ScrollViewStyleReset,
	useServerDocumentContext,
} from "expo-router/html";
import type { ReactNode } from "react";

// The day and night palettes' `background` (`theme.ts`): this page is
// rendered ahead of time, before the browser says which the app will use.
const dayBackground = "#FFFFFF";
const nightBackground = "#17181B";

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
				<style>{`html, body, #root { background-color: ${dayBackground}; color-scheme: light; } @media (prefers-color-scheme: dark) { html, body, #root { background-color: ${nightBackground}; color-scheme: dark; } }`}</style>
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
