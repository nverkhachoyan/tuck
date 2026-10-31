import { useMemo } from "react";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { useStore } from "../../store";
import { parsePenSettings, penBrushFor, stepPenSize } from "./penSettings";

export type PenController = ReturnType<typeof usePenTool>;

/**
 * Controller for freehand pen strokes.
 * - Manages pen tip, color, and size settings.
 * - Dispatches finished strokes to the active drawing layer.
 * - Supports keyboard stepping with [ and ].
 */
export function usePenTool({ documentSize }: Pick<ToolEnv, "documentSize">) {
	const { drawStroke } = useStore((state) => state.actions);
	const [settings, setSettings] = usePreference(
		"penSettings",
		parsePenSettings,
	);

	const stepSize = (step: 1 | -1) => {
		const next = stepPenSize(settings, step);
		if (next !== settings) setSettings(next);
	};

	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: {
				type: "draw",
				brush: penBrushFor(settings, documentSize),
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
