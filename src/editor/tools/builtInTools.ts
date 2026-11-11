import { adjustTool } from "./adjust/adjustTool";
import type { BUILT_IN_SPECS } from "./builtInSpecs";
import { cropTool } from "./crop/cropTool";
import { cutTool } from "./cut/cutTool";
import { removeBgTool } from "./cut/removeBgTool";
import type { Tool } from "./defineTool";
import { eraserTool } from "./eraser/eraserTool";
import { findTool } from "./find/findTool";
import { penTool } from "./pen/penTool";
import { redactTool } from "./redact/redactTool";
import { shapeTool } from "./shape/shapeTool";
import { stickersTool } from "./stickers/stickersTool";
import { textTool } from "./text/textTool";

/** The tools the editor has unless it's given others, by id. */
export const BUILT_IN_TOOLS = {
	text: textTool,
	pen: penTool,
	shape: shapeTool,
	eraser: eraserTool,
	redact: redactTool,
	find: findTool,
	sticker: stickersTool,
	cut: cutTool,
	removeBg: removeBgTool,
	crop: cropTool,
	adjust: adjustTool,
} satisfies Record<keyof typeof BUILT_IN_SPECS, Tool>;
