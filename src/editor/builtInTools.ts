import type { BUILT_IN_SPECS } from "./builtInSpecs";
import type { Tool } from "./defineTool";
import { adjustTool } from "./tools/adjust/adjustTool";
import { cropTool } from "./tools/crop/cropTool";
import { cutTool } from "./tools/cut/cutTool";
import { removeBgTool } from "./tools/cut/removeBgTool";
import { drawTool } from "./tools/draw/drawTool";
import { findTool } from "./tools/find/findTool";
import { redactTool } from "./tools/redact/redactTool";
import { stickersTool } from "./tools/stickers/stickersTool";
import { textTool } from "./tools/text/textTool";

/** The tools the editor has unless it's given others, by id. */
export const BUILT_IN_TOOLS = {
	text: textTool,
	draw: drawTool,
	redact: redactTool,
	find: findTool,
	sticker: stickersTool,
	cut: cutTool,
	removeBg: removeBgTool,
	crop: cropTool,
	adjust: adjustTool,
} satisfies Record<keyof typeof BUILT_IN_SPECS, Tool>;
