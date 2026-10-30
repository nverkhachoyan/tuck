import type { ToolSpec } from "../../toolSpec.ts";

// B cuts part of a photo out, taking the rest away. A hidden photo can't
// be cut. Until Done, its cut is only a selection.
export const cutSpec = {
	target: "image",
	tray: true,
	sized: true,
	previews: true,
	label: "Cut",
	icon: "scissors-cutting",
	key: "B",
	shortcut: "Cut",
	actsOn: (layer) => layer.type === "image" && !layer.hidden,
} as const satisfies ToolSpec;
