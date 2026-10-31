import { useMemo } from "react";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { useStore } from "../../store";
import { selectSelectedShape } from "../../store/editorSlice";
import {
	parseShapeSettings,
	shapePatch,
	shapeStyleFor,
	stepShapeSize,
	withSelectedShape,
} from "./shapeSettings";

export type ShapeController = ReturnType<typeof useShapeTool>;

/**
 * Controller for vector geometric shapes.
 * - Manages shape kind, stroke width, and outline color.
 * - Restyles selected shapes on change, or deselects when geometry changes (line vs box).
 * - Drags out new shapes via canvasInput.
 */
export function useShapeTool({
	open,
	documentSize,
}: Pick<ToolEnv, "open" | "documentSize">) {
	const selectedShape = useStore(selectSelectedShape);
	const { setShapeStyle, addShape } = useStore((state) => state.actions);
	const [shapeSettings, setShapeSettings] = usePreference(
		"shapeSettings",
		parseShapeSettings,
	);

	const isStylingSelected = !open && selectedShape !== undefined;
	const restyledShape = open || isStylingSelected ? selectedShape : undefined;
	const settings = useMemo(
		() =>
			restyledShape
				? withSelectedShape(shapeSettings, restyledShape, documentSize)
				: shapeSettings,
		[shapeSettings, restyledShape, documentSize],
	);

	const change = (next: typeof settings) => {
		setShapeSettings(next);
		if (!restyledShape) return;
		const edit = shapePatch(
			settings,
			next,
			documentSize,
			restyledShape.transform.scaleX,
		);
		setShapeStyle(restyledShape.id, edit);
	};

	const stepSize = (step: 1 | -1) => {
		const next = stepShapeSize(settings, step);
		if (next !== settings) change(next);
	};

	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: {
				type: "drawShape",
				shape: settings.shape,
				style: shapeStyleFor(settings, documentSize),
			},
		}),
		[settings, documentSize],
	);

	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type === "drawShape") {
			addShape(stroke.shape, stroke.placement, stroke.style);
		}
	};

	return {
		settings,
		change,
		stepSize,
		canvasInput,
		finishStroke,
		isStylingSelected,
		selectedShape,
	};
}
