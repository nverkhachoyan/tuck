import { defineTool } from "../../defineTool";
import { BrushOptions, DrawBar, DrawPanel } from "./DrawPanel";
import type { DrawController } from "./useDrawTool";

export const drawTool = defineTool<DrawController>({
	id: "draw",
	views: { Dock: DrawPanel, Bar: DrawBar, Tray: BrushOptions },
	deselectOnDone: true,
	stepSize: (draw, step) => draw.stepSize(step),
});
