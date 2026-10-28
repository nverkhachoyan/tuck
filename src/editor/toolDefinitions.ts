import type { ToolDefinition } from "./defineTool";
import type { EditorTool } from "./editorMode";
import { adjustTool } from "./tools/adjust/adjustTool";
import { cutOutTool } from "./tools/cutout/cutOutTool";
import { drawTool } from "./tools/draw/drawTool";
import { findTool } from "./tools/find/findTool";
import { redactTool } from "./tools/redact/redactTool";
import type { EditorTools } from "./useEditorTools";

/** Each tool's definition, from its own folder, by its name in the mode. */
export const TOOL_DEFINITIONS: {
	[Tool in EditorTool]: ToolDefinition<EditorTools[Tool]>;
} = {
	draw: drawTool,
	redact: redactTool,
	find: findTool,
	cutOut: cutOutTool,
	adjust: adjustTool,
};

/**
 * `tool`'s definition and its controller from `tools`. TypeScript can't
 * follow one tool's name to both, so they meet here as one pair.
 */
export function toolWithController(tool: EditorTool, tools: EditorTools) {
	return {
		definition: TOOL_DEFINITIONS[tool] as ToolDefinition<unknown>,
		controller: tools[tool] as unknown,
	};
}

export function isTool(panel: string): panel is EditorTool {
	return panel in TOOL_DEFINITIONS;
}

/** What `tool`'s Done says, when it isn't "Done". */
export function toolDoneLabel(tool: EditorTool, tools: EditorTools) {
	const { definition, controller } = toolWithController(tool, tools);
	return definition.doneLabel?.(controller);
}
