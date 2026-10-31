import { useEffect, useMemo } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { useStore } from "../../store";
import { parsePenSettings, penBrushFor, stepPenSize } from "./penSettings";

export type PenController = ReturnType<typeof usePenTool>;

const KEY = "penSettings";
const EARLIER_KEY = "brushSettings";

const parseSavedPenSettings = (saved: unknown) =>
	parsePenSettings(saved === undefined ? readPreference(EARLIER_KEY) : saved);

/**
 * Controller for freehand pen strokes.
 * - Manages pen tip, color, and size settings.
 * - Dispatches finished strokes to the active drawing layer.
 * - Supports keyboard stepping with [ and ].
 */
export function usePenTool({ documentSize }: Pick<ToolEnv, "documentSize">) {
	const { drawStroke } = useStore((state) => state.actions);
	const [settings, setSettings] = usePreference(KEY, parseSavedPenSettings);
	useEffect(() => {
		if (
			readPreference(KEY) === undefined &&
			readPreference(EARLIER_KEY) !== undefined
		) {
			writePreference(KEY, settings);
		}
	}, [settings]);

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
