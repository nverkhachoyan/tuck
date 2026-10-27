import { createContext, useContext } from "react";
import type { RedactLook } from "./shell/redactLook";

/**
 * What a tool's views read from the editor around them, rather than from
 * their own tool.
 * - `customColor`: the last color picked from a picker, which every custom
 *   swatch keeps.
 * - `startEyedropper`: picks a color from the canvas, handing it to `apply`.
 * - `redactLook`: how new redactions look, whichever tool adds them.
 * - `trayOpen`: whether the phone's tray of tool options is open.
 * - `bottomInset`: what a tray over the dock clears.
 * - `cancel`: the open tool's Cancel.
 */
export type EditorContextValue = {
	customColor: string | null;
	setCustomColor: (color: string) => void;
	startEyedropper: (apply: (color: string) => void) => void;
	redactLook: RedactLook;
	changeRedactLook: (change: Partial<RedactLook>) => void;
	trayOpen: boolean;
	toggleTray: () => void;
	closeTray: () => void;
	bottomInset: number;
	cancel: () => void;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
	const context = useContext(EditorContext);
	if (!context) throw new Error("A tool's view needs the editor around it.");
	return context;
}

/**
 * A color control whose colors go to `apply`: a color from its picker,
 * which becomes the custom color too, and the eyedropper, for a color from
 * the canvas.
 */
export function useColorTarget(apply: (color: string) => void) {
	const { customColor, setCustomColor, startEyedropper } = useEditorContext();
	return {
		customColor,
		onPickCustom: (color: string) => {
			apply(color);
			setCustomColor(color);
		},
		onEyedropper: () => startEyedropper(apply),
	};
}
