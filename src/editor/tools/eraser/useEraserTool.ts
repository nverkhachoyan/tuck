import { useMemo } from "react";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { useStore } from "../../store";
import {
	eraserBrushFor,
	parseEraserSettings,
	stepEraserSize,
} from "./eraserSettings";

export type EraserController = ReturnType<typeof useEraserTool>;

/**
 * Controller for erasing drawing strokes and shapes.
 * - Manages eraser size index.
 * - Erases on drag via canvasInput.
 */
export function useEraserTool({ documentSize }: Pick<ToolEnv, "documentSize">) {
	const { drawStroke } = useStore((state) => state.actions);
	const [settings, setSettings] = usePreference(
		"eraserSettings",
		parseEraserSettings,
	);

	const stepSize = (step: 1 | -1) => {
		const next = stepEraserSize(settings, step);
		if (next !== settings) setSettings(next);
	};

	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: {
				type: "draw",
				brush: eraserBrushFor(settings, documentSize),
			},
		}),
		[settings, documentSize],
	);

	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type === "draw") {
			drawStroke({ ...stroke.brush, points: stroke.points });
		}
	};

	return {
		settings,
		change: setSettings,
		stepSize,
		canvasInput,
		finishStroke,
	};
}
