import { defineTool } from "../defineTool";
import { EdgeCard, EdgePanel } from "./EdgePanel";
import { edgeSpec } from "./edgeSpec";
import { type EdgeController, useEdgeTool } from "./useEdgeTool";

export const edgeTool = defineTool<EdgeController>({
	spec: edgeSpec,
	useController: useEdgeTool,
	views: { Dock: EdgePanel, Card: EdgeCard },
	canvasInput: (edge) => edge.canvasInput,
	reset: (edge) => edge.reset,
});
