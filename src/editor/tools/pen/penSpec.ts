import type { ToolSpec } from "../../toolSpec.ts";

export const penSpec = {
	target: "none",
	tray: true,
	sized: true,
	undoSteps: "marks",
	label: "Pen",
	icon: "draw",
	key: "D",
	shortcut: "Pen",
	actsOn: (layer) => layer.type === "drawing" && !layer.locked,
} as const satisfies ToolSpec;
