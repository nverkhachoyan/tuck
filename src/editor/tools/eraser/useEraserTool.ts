import { useEffect, useMemo, useState } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { removedLayers } from "../../layers/drawing/drawingEdits";
import type { Layer } from "../../layers/layer";
import { SHAPE_NAMES } from "../../shell/shapeIcons";
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

// What the notice calls a layer the Eraser removed: a drawing or a shape,
// named as the Layers panel names them.
const erasedName = (layer: Layer) =>
	layer.type === "shape" ? SHAPE_NAMES[layer.shape] : "Drawing";

/**
 * Controller for erasing drawings and shapes.
 * - Manages eraser size index.
 * - Erases on drag via canvasInput, through every unlocked drawing and
 *   shape the swipe crosses.
 * - Says when a swipe removes a whole drawing or shape (`news`), naming the
 *   topmost one that went; Undo brings back the whole swipe.
 */
export function useEraserTool({
	documentSize,
	notify,
}: Pick<ToolEnv, "documentSize" | "notify">) {
	const { eraseStroke } = useStore((state) => state.actions);
	const [settings, setSettings] = usePreference(KEY, parseSavedEraserSettings);
	const [news, setNews] = useState<string | null>(null);
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
				type: "erase",
				width: eraserBrushFor(settings, documentSize).width,
				scope: null,
			},
		}),
		[settings, documentSize],
	);

	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type !== "erase") return;
		const before = useStore.getState().document;
		eraseStroke(
			{ type: "eraser", width: stroke.width, points: stroke.points },
			stroke.scope,
		);
		const after = useStore.getState().document;
		const removed =
			before && after ? removedLayers(before, after).at(-1) : undefined;
		// Cleared by a swipe that removes nothing, so the next removal is
		// announced even when it's named the same.
		if (!removed) {
			setNews(null);
			return;
		}
		const name = erasedName(removed);
		notify(`${name} erased`);
		setNews(`${name} removed`);
	};

	return {
		settings,
		change: setSettings,
		stepSize,
		canvasInput,
		finishStroke,
		news,
	};
}
