import { defineTool } from "../../defineTool";
import { AdjustCard, AdjustPanel } from "./AdjustPanel";
import { adjustSpec } from "./adjustSpec";
import { type AdjustController, useAdjustTool } from "./useAdjustTool";

export const adjustTool = defineTool<AdjustController>({
	spec: adjustSpec,
	useController: useAdjustTool,
	views: { Dock: AdjustPanel, Card: AdjustCard },
	canvasInput: (adjust) => adjust.canvasInput,
	reset: (adjust) => adjust.reset,
});
