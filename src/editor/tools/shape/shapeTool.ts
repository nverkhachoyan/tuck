import { defineTool } from "../../defineTool";
import { type ShapeKind, shapeKinds } from "../../layers/shape/shape";
import { SHAPE_ICONS, SHAPE_NAMES } from "../../shell/shapeIcons";
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
	variants: () =>
		shapeKinds.map((kind) => ({
			id: kind,
			label: SHAPE_NAMES[kind],
			icon: SHAPE_ICONS[kind],
		})),
	activeVariant: (shape) => shape.settings.shape,
	selectVariant: (shape, kind) =>
		shape.change({ ...shape.settings, shape: kind as ShapeKind }),
	variantEntry: (shape) => ({
		label: SHAPE_NAMES[shape.settings.shape],
		icon: SHAPE_ICONS[shape.settings.shape],
	}),
});
