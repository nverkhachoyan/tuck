import { adjustSpec } from "./tools/adjust/adjustSpec.ts";
import { cutOutSpec } from "./tools/cutout/cutOutSpec.ts";
import { drawSpec } from "./tools/draw/drawSpec.ts";
import { findSpec } from "./tools/find/findSpec.ts";
import { redactSpec } from "./tools/redact/redactSpec.ts";

/** Each tool's spec, from its own folder, by its name in the mode. */
export const TOOL_SPECS = {
	draw: drawSpec,
	redact: redactSpec,
	find: findSpec,
	cutOut: cutOutSpec,
	adjust: adjustSpec,
};
