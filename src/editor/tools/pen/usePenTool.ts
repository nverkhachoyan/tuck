import { useEffect, useMemo, useRef } from "react";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import type { CanvasInput } from "../../canvas/canvasInput";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { DrawingLayer } from "../../layers/drawing/drawing";
import {
	continuesMark,
	type LastStroke,
	markGap,
	sameStyle,
} from "../../layers/drawing/marks";
import { useStore } from "../../store";
import type { ToolEnv } from "../defineTool";
import {
	markPatch,
	type PenSettings,
	parsePenSettings,
	penBrushFor,
	stepPenSize,
	withSelectedMark,
} from "./penSettings";

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
 * - Manages pen tip, color, and size settings. Opened from a mark's
 *   actions, they show the mark's style, and changing them restyles it
 *   (one undo step each), as Shape does a selected shape.
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
	const { drawStroke, restyleDrawing } = useStore((state) => state.actions);
	const [penSettings, setPenSettings] = usePreference(
		KEY,
		parseSavedPenSettings,
	);
	const mark = on?.type === "drawing" ? on : null;
	const settings = useMemo(
		() =>
			mark ? withSelectedMark(penSettings, mark, documentSize) : penSettings,
		[penSettings, mark, documentSize],
	);
	const setSettings = (next: PenSettings) => {
		setPenSettings(next);
		if (mark) restyleDrawing(mark.id, markPatch(settings, next, documentSize));
	};
	useEffect(() => {
		if (
			readPreference(KEY) === undefined &&
			readPreference(EARLIER_KEY) !== undefined
		) {
			writePreference(KEY, penSettings);
		}
	}, [penSettings]);

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
		const openedPen = mark && lastPenOf(mark);
		let joinId: string | null = null;
		if (mark && openedPen && sameStyle(openedPen, pen)) {
			joinId = mark.id;
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
