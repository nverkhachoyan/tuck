import { defineTool } from "../../defineTool";
import { BrushOptions, DrawBar, DrawPanel } from "./DrawPanel";
import { drawSpec } from "./drawSpec";
import type { DrawController } from "./useDrawTool";

export const drawTool = defineTool<DrawController>({
	spec: drawSpec,
	views: { Dock: DrawPanel, Bar: DrawBar, Tray: BrushOptions },
	canvasInput: (draw) => draw.canvasInput,
	deselectOnDone: true,
	stepSize: (draw, step) => draw.stepSize(step),
});
