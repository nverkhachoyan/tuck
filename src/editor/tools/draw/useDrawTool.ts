import { useMemo } from "react";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { isLine, isLineShape } from "../../layers/shape/shape";
import { useStore } from "../../store";
import {
	selectSelectedLayer,
	selectSelectedShape,
} from "../../store/editorSlice";
import {
	type BrushSettings,
	drawCanvasTool,
	parseBrushSettings,
	shapeEdit,
	stepBrushSize,
	withShape,
} from "./brushSettings";

export type DrawController = ReturnType<typeof useDrawTool>;

/**
 * Draw's settings, kept between sessions. While Draw is `open` with the
 * shape tool, they show the selected shape's style, and changing them
 * restyles that one. A kind it can't become, a box for a line or a line for
 * a box, starts a new shape instead. `stepSize` steps the brush's size for
 * `[` and `]`, `canvasInput` paints or drags out shapes with them, and
 * `finishStroke` adds what's painted or dragged out to the document.
 */
export function useDrawTool({
	open,
	documentSize,
}: Pick<ToolEnv, "open" | "documentSize">) {
	const selectedShape = useStore(selectSelectedShape);
	const selectedType = useStore((state) => selectSelectedLayer(state)?.type);
	const { setShapeStyle, selectLayer, drawStroke, addShape } = useStore(
		(state) => state.actions,
	);
	const [brushSettings, setBrushSettings] = usePreference(
		"brushSettings",
		parseBrushSettings,
	);
	const restyledShape =
		open && brushSettings.tool === "shape" ? selectedShape : undefined;
	const settings = useMemo(
		() =>
			restyledShape
				? withShape(brushSettings, restyledShape, documentSize)
				: brushSettings,
		[brushSettings, restyledShape, documentSize],
	);
	const change = (next: BrushSettings) => {
		setBrushSettings(next);
		if (!restyledShape) return;
		const edit = shapeEdit(
			settings,
			next,
			documentSize,
			restyledShape.transform.scaleX,
		);
		if (edit.shape && isLineShape(edit.shape) !== isLine(restyledShape)) {
			selectLayer(null);
		} else {
			setShapeStyle(restyledShape.id, edit);
		}
	};
	// For drawing to start with the tool that fits the selection: the shape
	// tool for a shape, and a pen for a drawing. Otherwise the tool used
	// last, but never the eraser, so the first stroke shows. Its color and
	// sizes stay.
	const chooseTool = () =>
		setBrushSettings((current) => {
			if (selectedType === "shape") return { ...current, tool: "shape" };
			return current.tool === "eraser" ||
				(selectedType === "drawing" && current.tool === "shape")
				? { ...current, tool: current.lastBrush }
				: current;
		});

	const stepSize = (step: 1 | -1) => {
		const next = stepBrushSize(settings, step);
		if (next !== settings) change(next);
	};

	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: drawCanvasTool(settings, documentSize),
		}),
		[settings, documentSize],
	);

	const finishStroke = (stroke: ToolStroke) => {
		switch (stroke.type) {
			case "draw":
				drawStroke({ ...stroke.brush, points: stroke.points });
				break;
			case "drawShape":
				addShape(stroke.shape, stroke.placement, stroke.style);
				break;
		}
	};

	return { settings, change, chooseTool, stepSize, canvasInput, finishStroke };
}
