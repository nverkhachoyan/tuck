import type { ToolSpec } from "../../toolSpec.ts";

export const redactSpec = {
	target: "none",
	tray: true,
	sized: true,
	label: "Redact",
	icon: "blur",
	key: "R",
	shortcut: "Redact",
	actsOn: (layer) => layer.type === "image" && !layer.hidden && !layer.sticker,
} as const satisfies ToolSpec;
