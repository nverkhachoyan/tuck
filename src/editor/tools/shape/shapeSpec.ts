import type { ToolSpec } from "../toolSpec.ts";

export const shapeSpec = {
	target: "none",
	undoSteps: "marks",
	tray: true,
	sized: true,
	label: "Shape",
	icon: "shape-outline",
	key: "S",
	shortcut: "Shape",
	actsOn: () => false,
} as const satisfies ToolSpec;
