import { defineTool } from "../../defineTool";
import { AdjustInspector, AdjustPanel } from "./AdjustPanel";
import type { AdjustController } from "./useAdjustTool";

export const adjustTool = defineTool<AdjustController>({
	id: "adjust",
	views: { Dock: AdjustPanel, Inspector: AdjustInspector },
});
