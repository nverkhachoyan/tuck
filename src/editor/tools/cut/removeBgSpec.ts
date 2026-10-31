import type { ToolSpec } from "../../toolSpec.ts";

// G removes a photo's background in one step, opening nothing. A hidden
// photo has none to remove.
export const removeBgSpec = {
	target: "image",
	tray: false,
	sized: false,
	action: true,
	label: "Remove BG",
	icon: "auto-fix",
	key: "G",
	shortcut: "Remove the background",
	actsOn: (layer) => layer.type === "image" && !layer.hidden && !layer.sticker,
} as const satisfies ToolSpec;
