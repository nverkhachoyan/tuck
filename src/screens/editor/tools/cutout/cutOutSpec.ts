import type { ToolSpec } from "../../toolSpec.ts";

export const cutOutSpec = {
	id: "cutOut",
	target: "image",
	tray: true,
	sized: true,
} as const satisfies ToolSpec;
