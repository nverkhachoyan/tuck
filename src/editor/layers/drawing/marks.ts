import { toLayerSpace } from "../../document/geometry.ts";
import { hitTestDrawing } from "../strokes.ts";
import type { Brush, DrawingLayer, Stroke } from "./drawing.ts";

/**
 * How strokes group into marks: one drawing per word, arrow, or circle,
 * by pause, distance, and style rather than by Pen session. Starting
 * defaults, to tune on a phone (#96):
 * - `MARK_PAUSE_MS` with `MARK_GAP`: a stroke begun this soon after the
 *   last, within this many stroke widths of its ink, continues its mark.
 * - `MARK_NEAR_PAUSE_MS` with `MARK_NEAR_GAP`: a longer pause, but closer.
 */
export const MARK_PAUSE_MS = 1000;
export const MARK_NEAR_PAUSE_MS = 2000;
export const MARK_GAP = 6;
export const MARK_NEAR_GAP = 1.5;

/** The mark the last stroke went to, and when it ended. Never saved. */
export type LastStroke = { markId: string; endedAt: number };

/**
 * Whether two brushes draw one mark: the same tip and color. A size change
 * keeps the mark (open question 2's lean).
 */
export function sameStyle(a: Brush, b: Brush): boolean {
	if (a.type !== "pen" || b.type !== "pen") return false;
	return a.tip === b.tip && a.color.toLowerCase() === b.color.toLowerCase();
}

// The mark's last pen stroke, whose style a new stroke must match.
function lastPen(mark: DrawingLayer): Stroke | undefined {
	for (let i = mark.strokes.length - 1; i >= 0; i--) {
		if (mark.strokes[i].type === "pen") return mark.strokes[i];
	}
	return undefined;
}

/**
 * How long after the last stroke `stroke` began (`pause`, in
 * milliseconds), and how far its first point is from `mark`'s visible ink
 * in its own widths (`gap`: 0 on the ink, Infinity past `MARK_GAP`). For
 * the tuning log, and what `continuesMark` decides on.
 */
export function markGap(
	mark: DrawingLayer,
	last: LastStroke,
	stroke: Stroke & { type: "pen" },
	startedAt: number,
): { pause: number; gap: number } {
	const pause = startedAt - last.endedAt;
	const point = toLayerSpace(mark.transform, {
		x: stroke.points[0],
		y: stroke.points[1],
	});
	const width = stroke.width / mark.transform.scaleX;
	// The smallest of a few steps out to `MARK_GAP` that reaches the ink.
	for (const gap of [0, MARK_NEAR_GAP, 3, MARK_GAP]) {
		if (hitTestDrawing(mark, point, gap * width)) return { pause, gap };
	}
	return { pause, gap: Number.POSITIVE_INFINITY };
}

/**
 * Whether a new pen `stroke` (document space), begun at `startedAt`,
 * continues `mark`: it's the mark the last stroke went to, unlocked, in the
 * same style as its last pen, and the stroke starts within `MARK_GAP`
 * widths of its visible ink after a pause up to `MARK_PAUSE_MS`, or within
 * `MARK_NEAR_GAP` widths after one up to `MARK_NEAR_PAUSE_MS`. A stroke
 * never joins an older mark by itself, even touching it.
 */
export function continuesMark(
	mark: DrawingLayer,
	last: LastStroke | null,
	stroke: Stroke & { type: "pen" },
	startedAt: number,
): boolean {
	if (!last || last.markId !== mark.id || mark.locked) return false;
	const pen = lastPen(mark);
	if (!pen || !sameStyle(pen, stroke)) return false;
	const { pause, gap } = markGap(mark, last, stroke, startedAt);
	if (pause < 0) return false;
	return (
		(pause <= MARK_PAUSE_MS && gap <= MARK_GAP) ||
		(pause <= MARK_NEAR_PAUSE_MS && gap <= MARK_NEAR_GAP)
	);
}
