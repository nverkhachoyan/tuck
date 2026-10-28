import type { ToolDefinition } from "./defineTool";
import type { EditorTool } from "./editorMode";
import { adjustTool } from "./tools/adjust/adjustTool";
import { cutOutTool } from "./tools/cutout/cutOutTool";
import { drawTool } from "./tools/draw/drawTool";
import { findTool } from "./tools/find/findTool";
import { redactTool } from "./tools/redact/redactTool";

/** Each tool's definition, from its own folder, by its name in the mode. */
export const TOOL_DEFINITIONS = {
	draw: drawTool,
	redact: redactTool,
	find: findTool,
	cutOut: cutOutTool,
	adjust: adjustTool,
} satisfies Record<EditorTool, unknown>;

/** Each tool's controller, as its definition's `useController` built it. */
export type ToolControllers = Record<EditorTool, unknown>;

/**
 * `tool`'s definition and its controller from `controllers`. A list of
 * tools can't carry each controller's type, so they meet here as one pair.
 */
export function toolWithController(
	tool: EditorTool,
	controllers: ToolControllers,
) {
	return {
		definition: TOOL_DEFINITIONS[tool] as ToolDefinition<unknown>,
		controller: controllers[tool],
	};
}

export function isTool(panel: string): panel is EditorTool {
	return panel in TOOL_DEFINITIONS;
}

/** What `tool`'s Done says, when it isn't "Done". */
export function toolDoneLabel(tool: EditorTool, controllers: ToolControllers) {
	const { definition, controller } = toolWithController(tool, controllers);
	return definition.doneLabel?.(controller);
}
