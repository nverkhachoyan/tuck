import type { ToolSpec } from "../../toolSpec.ts";

export const textSpec = {
	target: "none",
	tray: false,
	sized: false,
	takesKeys: "typing",
	label: "Text",
	icon: "format-text",
	key: "T",
	shortcut: "Add text",
	actsOn: () => false,
} as const satisfies ToolSpec;
