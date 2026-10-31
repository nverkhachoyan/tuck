import { useEffect, useMemo } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
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

const KEY = "eraserSettings";
const EARLIER_KEY = "brushSettings";

const parseSavedEraserSettings = (saved: unknown) =>
	parseEraserSettings(
		saved === undefined ? readPreference(EARLIER_KEY) : saved,
	);

/**
 * Controller for erasing drawing strokes and shapes.
 * - Manages eraser size index.
 * - Erases on drag via canvasInput.
 */
export function useEraserTool({ documentSize }: Pick<ToolEnv, "documentSize">) {
	const { drawStroke } = useStore((state) => state.actions);
	const [settings, setSettings] = usePreference(KEY, parseSavedEraserSettings);
	useEffect(() => {
		if (
			readPreference(KEY) === undefined &&
			readPreference(EARLIER_KEY) !== undefined
		) {
			writePreference(KEY, settings);
		}
	}, [settings]);

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
