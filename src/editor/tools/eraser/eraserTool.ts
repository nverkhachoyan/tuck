import { defineTool } from "../../defineTool";
import { EraserBar, EraserPanel } from "./EraserPanel";
import { eraserSpec } from "./eraserSpec";
import { type EraserController, useEraserTool } from "./useEraserTool";

export const eraserTool = defineTool<EraserController>({
	spec: eraserSpec,
	useController: useEraserTool,
	views: { Dock: EraserPanel, Bar: EraserBar },
	canvasInput: (eraser) => eraser.canvasInput,
	finishStroke: (eraser, stroke) => eraser.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (eraser, step) => eraser.stepSize(step),
});
