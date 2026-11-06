import type { ToolSpec } from "../../toolSpec.ts";

export const eraserSpec = {
	target: "none",
	tray: false,
	sized: true,
	label: "Eraser",
	icon: "eraser",
	key: "X",
	shortcut: "Eraser",
	// Erase on a selected drawing waits for the Eraser to keep to it: opened
	// from the toolbar, it reaches every drawing.
	actsOn: () => false,
} as const satisfies ToolSpec;
