import type { ToolSpec } from "../../toolSpec.ts";

export const redactSpec = {
	id: "redact",
	target: "none",
	tray: true,
	sized: true,
} as const satisfies ToolSpec;
