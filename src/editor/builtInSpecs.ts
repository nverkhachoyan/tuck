import type { OwnTool } from "./shell/toolList.ts";
import { adjustSpec } from "./tools/adjust/adjustSpec.ts";
import { cropSpec } from "./tools/crop/cropSpec.ts";
import { cutSpec } from "./tools/cut/cutSpec.ts";
import { removeBgSpec } from "./tools/cut/removeBgSpec.ts";
import { eraserSpec } from "./tools/eraser/eraserSpec.ts";
import { findSpec } from "./tools/find/findSpec.ts";
import { penSpec } from "./tools/pen/penSpec.ts";
import { redactSpec } from "./tools/redact/redactSpec.ts";
import { shapeSpec } from "./tools/shape/shapeSpec.ts";
import { stickersSpec } from "./tools/stickers/stickersSpec.ts";
import { textSpec } from "./tools/text/textSpec.ts";

/** The built-in tools' specs, from their own folders, by id. */
export const BUILT_IN_SPECS = {
	text: textSpec,
	pen: penSpec,
	shape: shapeSpec,
	eraser: eraserSpec,
	redact: redactSpec,
	find: findSpec,
	sticker: stickersSpec,
	cut: cutSpec,
	removeBg: removeBgSpec,
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
	"crop",
	"cut",
	"adjust",
	"text",
	"pen",
	"shape",
	"eraser",
	"find",
	"redact",
	"sticker",
	"photo",
];
