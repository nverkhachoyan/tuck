import type { ToolSpec } from "../../toolSpec.ts";

export const findSpec = {
	id: "find",
	target: "photo",
	tray: true,
	sized: false,
} as const satisfies ToolSpec;
