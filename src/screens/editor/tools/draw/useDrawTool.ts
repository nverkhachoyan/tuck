import { useMemo } from "react";
import type { Size } from "@/model/geometry";
import { isLine, isLineShape } from "@/model/layers/shape";
import { usePreference } from "@/platform/usePreference";
import { useStore } from "@/store";
import { selectSelectedLayer, selectSelectedShape } from "@/store/editorSlice";
import {
	type BrushSettings,
	parseBrushSettings,
	shapeEdit,
	stepBrushSize,
	withShape,
} from "./brushSettings";

/**
 * Draw's settings, kept between sessions. While Draw is `active` with the
 * shape tool, they show the selected shape's style, and changing them
 * restyles that one. A kind it can't become, a box for a line or a line for
 * a box, starts a new shape instead. `stepSize` steps the brush's size for
 * `[` and `]`.
 */
export function useDrawTool(active: boolean, documentSize: Size) {
	const selectedShape = useStore(selectSelectedShape);
	const selectedType = useStore((state) => selectSelectedLayer(state)?.type);
	const { setShapeStyle, selectLayer } = useStore((state) => state.actions);
	const [brushSettings, setBrushSettings] = usePreference(
		"brushSettings",
		parseBrushSettings,
	);
	const restyledShape =
		active && brushSettings.tool === "shape" ? selectedShape : undefined;
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

	return { settings, change, chooseTool, stepSize };
}
