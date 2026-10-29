import type { SkParagraph } from "react-native-skia";
import { caretText } from "./caretText.ts";
import type { TextSelection } from "./selection.ts";

export type TextPoint = { x: number; y: number };
export type TextRect = { x: number; y: number; width: number; height: number };

/**
 * Where a text's caret, selection, and taps fall, measured in a Skia
 * paragraph, in the paragraph's space from its top left.
 * - `caretRect(index)`: a zero-width rect, as tall as its line, where a caret
 *   before `index` stands.
 * - `selectionRects(selection)`: the boxes a selection covers, one or more a
 *   line.
 * - `indexAt(point)`: the index nearest a point.
 */
export type CaretLayout = {
	caretRect: (index: number) => TextRect;
	selectionRects: (selection: TextSelection) => TextRect[];
	indexAt: (point: TextPoint) => number;
};

/**
 * A caret layout for `text`, wrapped at `width`. `buildParagraph` builds a
 * paragraph for a text in the drawn text's style: it's given `caretText`'s
 * copy, with a filler on each empty line, so its lines fall where the drawn
 * text's do, empty ones included. Indexes in and out are `text`'s.
 */
export function createCaretLayout(
	text: string,
	width: number,
	buildParagraph: (text: string) => SkParagraph,
): CaretLayout {
	const { caretText: measured, toCaret, fromCaret } = caretText(text);
	const paragraph = buildParagraph(measured);
	paragraph.layout(width);
	const toMeasured = (index: number) =>
		toCaret[Math.max(0, Math.min(index, text.length))];
	return {
		caretRect: (index) => {
			const j = toMeasured(index);
			// Before the character it's at, unless that ends the line: then
			// after the one before, which is never a line break (see
			// `caretText`).
			const before = j < measured.length && measured[j] !== "\n";
			const rects = before
				? paragraph.getRectsForRange(j, j + 1)
				: paragraph.getRectsForRange(j - 1, j);
			const rect = before ? rects[0] : rects[rects.length - 1];
			if (!rect) return { x: 0, y: 0, width: 0, height: paragraph.getHeight() };
			return {
				x: before ? rect.x : rect.x + rect.width,
				y: rect.y,
				width: 0,
				height: rect.height,
			};
		},
		selectionRects: ({ start, end }) =>
			paragraph
				.getRectsForRange(toMeasured(start), toMeasured(end))
				.map(({ x, y, width, height }) => ({ x, y, width, height })),
		indexAt: ({ x, y }) => {
			const j = paragraph.getGlyphPositionAtCoordinate(x, y);
			return fromCaret[Math.max(0, Math.min(j, measured.length))];
		},
	};
}
