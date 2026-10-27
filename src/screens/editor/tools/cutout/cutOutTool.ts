import { defineTool } from "../../defineTool";
import { CutOutBar, CutOutOptions, CutOutPanel } from "./CutOutPanel";
import type { CutOutController } from "./useCutOutTool";

export const cutOutTool = defineTool<CutOutController>({
	id: "cutOut",
	views: { Dock: CutOutPanel, Bar: CutOutBar, Tray: CutOutOptions },
	stepSize: (cutOut, step) => cutOut.stepSize(step),
});
