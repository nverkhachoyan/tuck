import type { BUILT_IN_SPECS } from "./builtInSpecs";
import type { Tool } from "./defineTool";
import { adjustTool } from "./tools/adjust/adjustTool";
import { cropTool } from "./tools/crop/cropTool";
import { cutOutTool } from "./tools/cutout/cutOutTool";
import { drawTool } from "./tools/draw/drawTool";
import { findTool } from "./tools/find/findTool";
import { redactTool } from "./tools/redact/redactTool";
import { stickersTool } from "./tools/stickers/stickersTool";

/** The tools the editor has unless it's given others, by id. */
export const BUILT_IN_TOOLS = {
	draw: drawTool,
	redact: redactTool,
	find: findTool,
	sticker: stickersTool,
	cutOut: cutOutTool,
	crop: cropTool,
	adjust: adjustTool,
} satisfies Record<keyof typeof BUILT_IN_SPECS, Tool>;
