import type { ToolSpec } from "../../toolSpec.ts";

// B cuts out the subject, taking its background away. A hidden photo can't
// be cut out.
export const cutOutSpec = {
	target: "image",
	tray: true,
	sized: true,
	label: "Cut out",
	icon: "scissors-cutting",
	key: "B",
	shortcut: "Cut out",
	actsOn: (layer) => layer.type === "image" && !layer.hidden,
} as const satisfies ToolSpec;
