import antonUrl from "@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

// The typeface of Tuck's wordmark, loaded the way the app bundles it.
new FontFace("Anton", `url(${antonUrl})`)
	.load()
	.then((font) => document.fonts.add(font))
	.catch(() => {});

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}
