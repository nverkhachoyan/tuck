import type { ToolSpec } from "../toolSpec.ts";

// M softens an image's mask, alpha, or border edges (S is Shape's, E is Adjust's).
export const edgeSpec = {
	target: "image",
	stickers: true,
	cancels: true,
	tray: false,
	sized: false,
	label: "Soften",
	icon: "feather",
	key: "M",
	shortcut: "Soften edges",
	actsOn: (layer) => layer.type === "image" && !layer.hidden,
} as const satisfies ToolSpec;
