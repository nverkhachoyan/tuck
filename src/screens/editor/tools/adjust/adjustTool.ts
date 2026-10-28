import { defineTool } from "../../defineTool";
import { AdjustInspector, AdjustPanel } from "./AdjustPanel";
import { adjustSpec } from "./adjustSpec";
import type { AdjustController } from "./useAdjustTool";

export const adjustTool = defineTool<AdjustController>({
	spec: adjustSpec,
	views: { Dock: AdjustPanel, Inspector: AdjustInspector },
});
