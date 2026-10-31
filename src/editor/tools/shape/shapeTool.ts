import { defineTool } from "../../defineTool";
import { ShapeBar, ShapePanel, ShapeTray } from "./ShapePanel";
import { shapeSpec } from "./shapeSpec";
import { type ShapeController, useShapeTool } from "./useShapeTool";

export const shapeTool = defineTool<ShapeController>({
	spec: shapeSpec,
	useController: useShapeTool,
	views: { Dock: ShapePanel, Bar: ShapeBar, Tray: ShapeTray },
	stylesLayer: (layer) => layer.type === "shape",
	canvasInput: (shape) => shape.canvasInput,
	finishStroke: (shape, stroke) => shape.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (shape, step) => shape.stepSize(step),
});
