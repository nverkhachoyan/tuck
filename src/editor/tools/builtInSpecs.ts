import type { OwnTool } from "../shell/toolList.ts";
import { adjustSpec } from "./adjust/adjustSpec.ts";
import { cropSpec } from "./crop/cropSpec.ts";
import { cutSpec } from "./cut/cutSpec.ts";
import { removeBgSpec } from "./cut/removeBgSpec.ts";
import { eraserSpec } from "./eraser/eraserSpec.ts";
import { findSpec } from "./find/findSpec.ts";
import { penSpec } from "./pen/penSpec.ts";
import { redactSpec } from "./redact/redactSpec.ts";
import { shapeSpec } from "./shape/shapeSpec.ts";
import { stickersSpec } from "./stickers/stickersSpec.ts";
import { textSpec } from "./text/textSpec.ts";

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
