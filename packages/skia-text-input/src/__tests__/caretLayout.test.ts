/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SkParagraph } from "react-native-skia";
import { createCaretLayout } from "../caretLayout.ts";

const CHAR = 10;
const LINE = 20;

// A monospaced paragraph that breaks only at "\n", measuring as Skia does:
// a box per line a range covers, and an empty line has none.
function fakeParagraph(text: string): SkParagraph {
	const lines: { start: number; end: number }[] = [];
	let start = 0;
	for (const line of text.split("\n")) {
		lines.push({ start, end: start + line.length });
		start += line.length + 1;
	}
	const paragraph = {
		layout: () => {},
		getHeight: () => lines.length * LINE,
		getRectsForRange: (from: number, to: number) =>
			lines.flatMap((line, row) => {
				const s = Math.max(from, line.start);
				const e = Math.min(to, line.end);
				if (s >= e) return [];
				return [
					{
						x: (s - line.start) * CHAR,
						y: row * LINE,
						width: (e - s) * CHAR,
						height: LINE,
					},
				];
			}),
		getGlyphPositionAtCoordinate: (x: number, y: number) => {
			const row = Math.max(0, Math.min(Math.floor(y / LINE), lines.length - 1));
			const line = lines[row];
			const column = Math.round(x / CHAR);
			return line.start + Math.max(0, Math.min(column, line.end - line.start));
		},
	};
	return paragraph as unknown as SkParagraph;
}

describe("createCaretLayout", () => {
	test("puts the caret before a character, and after a line's last", () => {
		const layout = createCaretLayout("ab\ncd", 100, fakeParagraph);
		assert.deepEqual(layout.caretRect(1), {
			x: 10,
			y: 0,
			width: 0,
			height: LINE,
		});
		// The end of the first line, before its break.
		assert.deepEqual(layout.caretRect(2), {
			x: 20,
			y: 0,
			width: 0,
			height: LINE,
		});
		assert.deepEqual(layout.caretRect(5), {
			x: 20,
			y: LINE,
			width: 0,
			height: LINE,
		});
	});

	test("stands the caret on an empty line, at its start", () => {
		const layout = createCaretLayout("a\n\nb", 100, fakeParagraph);
		assert.deepEqual(layout.caretRect(2), {
			x: 0,
			y: LINE,
			width: 0,
			height: LINE,
		});
	});

	test("clamps an index past the text to its end", () => {
		const layout = createCaretLayout("ab", 100, fakeParagraph);
		assert.deepEqual(layout.caretRect(9), layout.caretRect(2));
	});

	test("covers a selection with a box a line, an empty line's filler too", () => {
		const layout = createCaretLayout("ab\n\ncd", 100, fakeParagraph);
		assert.deepEqual(layout.selectionRects({ start: 1, end: 6 }), [
			{ x: 10, y: 0, width: 10, height: LINE },
			{ x: 0, y: LINE, width: CHAR, height: LINE },
			{ x: 0, y: LINE * 2, width: 20, height: LINE },
		]);
	});

	test("maps a point back to the text's index, either side of a filler", () => {
		const layout = createCaretLayout("ab\n\ncd", 100, fakeParagraph);
		assert.equal(layout.indexAt({ x: 12, y: 5 }), 1);
		assert.equal(layout.indexAt({ x: 0, y: LINE + 5 }), 3);
		assert.equal(layout.indexAt({ x: 50, y: LINE + 5 }), 3);
		assert.equal(layout.indexAt({ x: 50, y: LINE * 2 + 5 }), 6);
	});
});
