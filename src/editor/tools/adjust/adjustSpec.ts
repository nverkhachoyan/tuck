import type { ToolSpec } from "../../toolSpec.ts";

// E adjusts, since A is the stickers'.
export const adjustSpec = {
	target: "image",
	tray: false,
	sized: false,
	label: "Adjust",
	icon: "tune-variant",
	key: "E",
	shortcut: "Adjust",
	actsOn: (layer) => layer.type === "image",
} as const satisfies ToolSpec;
