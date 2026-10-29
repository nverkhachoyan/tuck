// Measured, never drawn: narrow, so it sits about where an empty line's
// alignment would put a caret, and not whitespace, which Skia gives no box
// on a line of its own.
const EMPTY_LINE_FILLER = ".";

/**
 * A text with a filler character on each empty line, and the indexes between
 * it and the original. Skia gives an empty line nothing to measure, so a
 * caret there has nowhere to stand; the filler gives it somewhere. It can't
 * change how the text wraps or how tall its lines are, so every other line
 * lays out the same.
 *
 * `toCaret[i]` is where index `i` of the text falls, before its line's filler
 * if it has one. `fromCaret[j]` is the text's index for index `j` of
 * `caretText`, either side of a filler.
 */
export type CaretText = {
	caretText: string;
	toCaret: number[];
	fromCaret: number[];
};

export function caretText(text: string): CaretText {
	let caretText = "";
	const toCaret: number[] = [];
	const fromCaret: number[] = [];
	for (let i = 0; i <= text.length; i++) {
		toCaret.push(caretText.length);
		fromCaret.push(i);
		const lineStart = i === 0 || text[i - 1] === "\n";
		const lineEnd = i === text.length || text[i] === "\n";
		if (lineStart && lineEnd) {
			caretText += EMPTY_LINE_FILLER;
			fromCaret.push(i);
		}
		if (i < text.length) caretText += text[i];
	}
	return { caretText, toCaret, fromCaret };
}
