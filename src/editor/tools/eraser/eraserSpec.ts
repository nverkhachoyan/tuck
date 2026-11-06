import type { ToolSpec } from "../../toolSpec.ts";

export const eraserSpec = {
	target: "none",
	tray: false,
	sized: true,
	undoSteps: "each",
	label: "Eraser",
	icon: "eraser",
	key: "X",
	shortcut: "Eraser",
	// From a drawing's actions it erases that drawing alone; from the
	// toolbar, every drawing it reaches.
	actsOn: (layer) => layer.type === "drawing" && !layer.locked,
} as const satisfies ToolSpec;
