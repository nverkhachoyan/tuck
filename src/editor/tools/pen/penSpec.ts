import type { ToolSpec } from "../../toolSpec.ts";

export const penSpec = {
	target: "none",
	tray: true,
	sized: true,
	label: "Pen",
	icon: "draw",
	key: "D",
	shortcut: "Pen",
	actsOn: (layer) => layer.type === "drawing",
} as const satisfies ToolSpec;
