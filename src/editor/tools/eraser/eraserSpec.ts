import type { ToolSpec } from "../../toolSpec.ts";

export const eraserSpec = {
	target: "none",
	tray: false,
	sized: true,
	label: "Eraser",
	icon: "eraser",
	key: "X",
	shortcut: "Eraser",
	actsOn: (layer) => layer.type === "drawing",
} as const satisfies ToolSpec;
