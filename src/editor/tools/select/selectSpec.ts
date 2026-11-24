import type { ToolSpec } from "../toolSpec.ts";

export const selectSpec = {
	target: "none",
	tray: false,
	sized: false,
	undoSteps: "each",
	keepsSelectionKeys: true,
	label: "Select",
	icon: "selection-drag",
	key: "V",
	shortcut: "Select layers",
	actsOn: () => false,
} as const satisfies ToolSpec;
