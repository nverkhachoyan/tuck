import { defineTool } from "../../defineTool";
import { CutBar, CutOptions, CutPanel } from "./CutPanel";
import { cutSpec } from "./cutSpec";
import { type CutController, useCutTool } from "./useCutTool";

export const cutTool = defineTool<CutController>({
	spec: cutSpec,
	useController: useCutTool,
	views: { Dock: CutPanel, Bar: CutBar, Tray: CutOptions },
	started: (cut, image) => cut.start(image),
	canvasInput: (cut) => cut.canvasInput,
	finishStroke: (cut, stroke) => cut.finishStroke(stroke),
	doneLabel: (cut) => cut.doneLabel,
	done: (cut) => cut.done(),
	reset: (cut) => cut.reset,
	announcement: (cut) => cut.news,
	stepSize: (cut, step) => cut.stepSize(step),
});
