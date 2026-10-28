import { defineTool } from "../../defineTool";
import { CutOutBar, CutOutOptions, CutOutPanel } from "./CutOutPanel";
import { cutOutSpec } from "./cutOutSpec";
import { type CutOutController, useCutOutTool } from "./useCutOutTool";

export const cutOutTool = defineTool<CutOutController>({
	spec: cutOutSpec,
	useController: useCutOutTool,
	views: { Dock: CutOutPanel, Bar: CutOutBar, Tray: CutOutOptions },
	started: (cutOut, image) => cutOut.start(image),
	canvasInput: (cutOut) => cutOut.canvasInput,
	finishStroke: (cutOut, stroke) => cutOut.finishStroke(stroke),
	reset: (cutOut) => cutOut.reset,
	announcement: (cutOut) => cutOut.news,
	stepSize: (cutOut, step) => cutOut.stepSize(step),
});
