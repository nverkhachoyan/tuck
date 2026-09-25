import {
	ScrollViewStyleReset,
	useServerDocumentContext,
} from "expo-router/html";
import type { ReactNode } from "react";

const documentBackground = "#0A0A0B";

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
				<meta name="theme-color" content={documentBackground} />
				<meta name="color-scheme" content="dark" />
				<style>{`html, body, #root { background-color: ${documentBackground}; color-scheme: dark; }`}</style>
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
