import type { OwnTool } from "./shell/toolList.ts";
import { adjustSpec } from "./tools/adjust/adjustSpec.ts";
import { cropSpec } from "./tools/crop/cropSpec.ts";
import { cutOutSpec } from "./tools/cutout/cutOutSpec.ts";
import { drawSpec } from "./tools/draw/drawSpec.ts";
import { findSpec } from "./tools/find/findSpec.ts";
import { redactSpec } from "./tools/redact/redactSpec.ts";
import { stickersSpec } from "./tools/stickers/stickersSpec.ts";

/** The built-in tools' specs, from their own folders, by id. */
export const BUILT_IN_SPECS = {
	draw: drawSpec,
	redact: redactSpec,
	find: findSpec,
	sticker: stickersSpec,
	cutOut: cutOutSpec,
	crop: cropSpec,
	adjust: adjustSpec,
};

/**
 * The order the dock and the rail show their buttons in, the built-in tools
 * among the editor's own entries. A selected layer's actions, and the list
 * of shortcuts, follow it too.
 */
export const BUILT_IN_TOOLBAR: readonly (
	| keyof typeof BUILT_IN_SPECS
	| OwnTool
)[] = [
	"text",
	"draw",
	"redact",
	"find",
	"sticker",
	"crop",
	"adjust",
	"cutOut",
	"photo",
];
