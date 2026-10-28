import type { ToolSpec } from "../../toolSpec.ts";

export const adjustSpec = {
	id: "adjust",
	target: "image",
	tray: false,
	sized: false,
} as const satisfies ToolSpec;
