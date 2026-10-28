import type { ToolSpec } from "../../toolSpec.ts";

// Crops the canvas whether or not it has a photo, and acts on no one layer.
export const cropSpec = {
	target: "none",
	tray: false,
	sized: false,
	takesKeys: true,
	label: "Crop",
	icon: "crop-rotate",
	key: "C",
	shortcut: "Crop",
	actsOn: () => false,
} as const satisfies ToolSpec;
