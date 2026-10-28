import type { ToolSpec } from "../../toolSpec.ts";

export const stickersSpec = {
	target: "none",
	tray: false,
	sized: false,
	label: "Sticker",
	icon: "sticker-emoji",
	key: "A",
	shortcut: "Add a sticker",
	actsOn: () => false,
} as const satisfies ToolSpec;
