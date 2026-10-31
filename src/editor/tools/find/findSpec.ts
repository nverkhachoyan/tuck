import type { ToolSpec } from "../../toolSpec.ts";

// A hidden photo can't be searched.
export const findSpec = {
	target: "photo",
	tray: true,
	sized: false,
	label: "Find",
	icon: "image-search-outline",
	key: "F",
	shortcut: "Find faces or text to redact",
	actsOn: (layer) => layer.type === "image" && !layer.hidden && !layer.sticker,
} as const satisfies ToolSpec;
