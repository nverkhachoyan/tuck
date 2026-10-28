import { defineTool } from "../../defineTool";
import { AdjustInspector, AdjustPanel } from "./AdjustPanel";
import { adjustSpec } from "./adjustSpec";
import { type AdjustController, useAdjustTool } from "./useAdjustTool";

export const adjustTool = defineTool<AdjustController>({
	spec: adjustSpec,
	useController: useAdjustTool,
	views: { Dock: AdjustPanel, Inspector: AdjustInspector },
	canvasInput: (adjust) => adjust.canvasInput,
	reset: (adjust) => adjust.reset,
});
