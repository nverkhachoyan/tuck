import { useEffect, useMemo, useState } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import type { CanvasInput } from "../../canvas/canvasInput";
import type { ToolStroke } from "../../canvas/canvasTool";
import { removedLayers } from "../../layers/drawing/drawingEdits";
import type { Layer } from "../../layers/layer";
import { SHAPE_NAMES } from "../../shell/shapeIcons";
import { useStore } from "../../store";
import type { ToolEnv } from "../defineTool";
import {
	type EraserMode,
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
 * - Manages its mode (Eraser or Stroke eraser) and eraser size index.
 * - Erases on drag via canvasInput, through every unlocked drawing and
 *   shape the swipe crosses, or only the drawing whose actions opened it
 *   (`on`).
 * - Closes once that drawing is erased away.
 * - Says when a swipe removes a whole drawing or shape (`news`), naming the
 *   topmost one that went; Undo brings back the whole swipe.
 */
export function useEraserTool({
	documentSize,
	notify,
	on,
	close,
}: Pick<ToolEnv, "documentSize" | "notify" | "on" | "close">) {
	const { eraseStroke, eraseWholeStrokes } = useStore((state) => state.actions);
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

	// The Stroke eraser has no size.
	const stepSize = (step: 1 | -1) => {
		if (settings.mode === "stroke") return;
		const next = stepEraserSize(settings, step);
		if (next !== settings) setSettings(next);
	};

	const scope = on?.id ?? null;
	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: {
				type: "erase",
				mode: settings.mode,
				width: eraserBrushFor(settings, documentSize).width,
				scope,
			},
		}),
		[settings, documentSize, scope],
	);

	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type !== "erase") return;
		const before = useStore.getState().document;
		if (stroke.mode === "stroke") {
			eraseWholeStrokes(stroke.points, stroke.reach, stroke.scope);
		} else {
			eraseStroke(
				{ type: "eraser", width: stroke.width, points: stroke.points },
				stroke.scope,
			);
		}
		const after = useStore.getState().document;
		const gone = before && after ? removedLayers(before, after) : [];
		const removed = gone.at(-1);
		// Cleared by a swipe that removes nothing, so the next removal is
		// announced even when it's named the same.
		if (!removed) {
			setNews(null);
			return;
		}
		const name = erasedName(removed);
		notify(`${name} erased`);
		setNews(`${name} removed`);
		// Erased away, the drawing it kept to leaves nothing to erase. The
		// notice is the editor's, so it outlives the tool.
		if (stroke.scope !== null && gone.some(({ id }) => id === stroke.scope)) {
			close();
		}
	};

	const setMode = (mode: EraserMode) => {
		if (mode !== settings.mode) setSettings({ ...settings, mode });
	};

	return {
		settings,
		change: setSettings,
		setMode,
		stepSize,
		canvasInput,
		finishStroke,
		news,
	};
}
