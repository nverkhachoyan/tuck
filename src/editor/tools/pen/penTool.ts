import { defineTool } from "../../defineTool";
import { PenBar, PenPanel, PenTray } from "./PenPanel";
import { penSpec } from "./penSpec";
import { type PenController, usePenTool } from "./usePenTool";

export const penTool = defineTool<PenController>({
	spec: penSpec,
	useController: usePenTool,
	views: { Dock: PenPanel, Bar: PenBar, Tray: PenTray },
	canvasInput: (pen) => pen.canvasInput,
	finishStroke: (pen, stroke) => pen.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (pen, step) => pen.stepSize(step),
});
