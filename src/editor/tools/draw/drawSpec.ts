import type { ToolSpec } from "../../toolSpec.ts";

export const drawSpec = {
	id: "draw",
	target: "none",
	tray: true,
	sized: true,
} as const satisfies ToolSpec;
