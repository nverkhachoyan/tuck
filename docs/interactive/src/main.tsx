import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";
import "./ui/fonts.ts";

// No StrictMode, as in the app: on web, its rehearsed unmount has a Skia
// `Canvas` free its last frame, which the remounted view then draws.
const root = document.getElementById("root");
if (root) {
	createRoot(root).render(<App />);
}
