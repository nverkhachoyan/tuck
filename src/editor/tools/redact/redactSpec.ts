import type { ToolSpec } from "../../toolSpec.ts";

export const redactSpec = {
	target: "none",
	tray: true,
	sized: true,
	label: "Redact",
	icon: "blur",
	key: "R",
	shortcut: "Redact",
	actsOn: (layer) => layer.type === "image" || layer.type === "redaction",
} as const satisfies ToolSpec;
