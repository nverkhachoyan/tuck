import { defineTool } from "../../defineTool";
import { BrushOptions, DrawBar, DrawPanel } from "./DrawPanel";
import { drawSpec } from "./drawSpec";
import { type DrawController, useDrawTool } from "./useDrawTool";

export const drawTool = defineTool<DrawController>({
	spec: drawSpec,
	useController: useDrawTool,
	views: { Dock: DrawPanel, Bar: DrawBar, Tray: BrushOptions },
	prepare: (draw) => draw.chooseTool(),
	canvasInput: (draw) => draw.canvasInput,
	finishStroke: (draw, stroke) => draw.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (draw, step) => draw.stepSize(step),
});
