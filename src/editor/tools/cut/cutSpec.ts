import type { ToolSpec } from "../../toolSpec.ts";

// B cuts part of a photo out, taking the rest away. A hidden photo can't
// be cut.
export const cutSpec = {
	target: "image",
	tray: true,
	sized: true,
	label: "Cut",
	icon: "scissors-cutting",
	key: "B",
	shortcut: "Cut",
	actsOn: (layer) => layer.type === "image" && !layer.hidden,
} as const satisfies ToolSpec;
