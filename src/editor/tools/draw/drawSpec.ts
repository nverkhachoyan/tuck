import type { ToolSpec } from "../../toolSpec.ts";

export const drawSpec = {
	target: "none",
	tray: true,
	sized: true,
	label: "Draw",
	icon: "draw",
	key: "D",
	shortcut: "Draw",
	actsOn: (layer) => layer.type === "drawing" || layer.type === "shape",
} as const satisfies ToolSpec;
