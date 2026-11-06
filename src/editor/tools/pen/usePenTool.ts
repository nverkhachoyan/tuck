import { useEffect, useMemo, useRef } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import type { DrawingLayer } from "../../layers/drawing/drawing";
import {
	continuesMark,
	type LastStroke,
	markGap,
	sameStyle,
} from "../../layers/drawing/marks";
import { useStore } from "../../store";
import { parsePenSettings, penBrushFor, stepPenSize } from "./penSettings";

export type PenController = ReturnType<typeof usePenTool>;

// A mark's last pen stroke, whose style a stroke joining it must match.
function lastPenOf(mark: DrawingLayer) {
	for (let i = mark.strokes.length - 1; i >= 0; i--) {
		if (mark.strokes[i].type === "pen") return mark.strokes[i];
	}
	return undefined;
}

const KEY = "penSettings";
const EARLIER_KEY = "brushSettings";

const parseSavedPenSettings = (saved: unknown) =>
	parsePenSettings(saved === undefined ? readPreference(EARLIER_KEY) : saved);

/**
 * Controller for freehand pen strokes.
 * - Manages pen tip, color, and size settings.
 * - Groups finished strokes into marks: opened from a mark's actions
 *   (`on`), strokes join it while they match its style; otherwise each joins
 *   the last stroke's mark when `continuesMark` says so, or starts one.
 *   Leaving Pen ends the mark.
 * - Supports keyboard stepping with [ and ].
 */
export function usePenTool({
	documentSize,
	open,
	on,
}: Pick<ToolEnv, "documentSize" | "open" | "on">) {
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

	// The mark the last stroke went to, forgotten when Pen closes.
	const last = useRef<LastStroke | null>(null);
	useEffect(() => {
		if (!open) last.current = null;
	}, [open]);

	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type !== "draw") return;
		const pen = { ...stroke.brush, points: stroke.points };
		const document = useStore.getState().document;
		const lastMark = document?.layers.find(
			(layer) => layer.id === last.current?.markId,
		);
		const opened = on?.type === "drawing" ? on : null;
		const openedPen = opened && lastPenOf(opened);
		let joinId: string | null = null;
		if (opened && openedPen && sameStyle(openedPen, pen)) {
			joinId = opened.id;
		} else if (
			lastMark?.type === "drawing" &&
			continuesMark(lastMark, last.current, pen, stroke.startedAt)
		) {
			joinId = lastMark.id;
		}
		if (__DEV__ && lastMark?.type === "drawing" && last.current) {
			const { pause, gap } = markGap(
				lastMark,
				last.current,
				pen,
				stroke.startedAt,
			);
			console.log(
				`[marks] pause ${Math.round(pause)} ms, gap ${gap} widths: ${joinId ? "joins" : "new mark"}`,
			);
		}
		drawStroke(pen, joinId);
		const markId = useStore.getState().selectedLayerId;
		last.current = markId ? { markId, endedAt: stroke.endedAt } : null;
	};

	return {
		settings,
		change: setSettings,
		stepSize,
		canvasInput,
		finishStroke,
	};
}
