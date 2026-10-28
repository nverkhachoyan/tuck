import { defineTool } from "../../defineTool";
import { CutOutBar, CutOutOptions, CutOutPanel } from "./CutOutPanel";
import { cutOutSpec } from "./cutOutSpec";
import type { CutOutController } from "./useCutOutTool";

export const cutOutTool = defineTool<CutOutController>({
	spec: cutOutSpec,
	views: { Dock: CutOutPanel, Bar: CutOutBar, Tray: CutOutOptions },
	canvasInput: (cutOut) => cutOut.canvasInput,
	finishStroke: (cutOut, stroke) => cutOut.finishStroke(stroke),
	stepSize: (cutOut, step) => cutOut.stepSize(step),
});
