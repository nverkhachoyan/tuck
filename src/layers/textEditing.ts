// Plain TypeScript, so Node's test runner can load it.

/** A range of a text layer's text, in UTF-16 code units, `start <= end`. */
export type TextSelection = { start: number; end: number };

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

// Letters, digits, and marks join words, and so do apostrophes within them.
const WORD_CHAR = /[\p{L}\p{N}\p{M}_'’]/u;

/**
 * The word around `index`, as a double tap selects it: the run of word
 * characters it touches, or of spaces, or else the one character after it.
 */
export function wordRange(text: string, index: number): TextSelection {
	const at = Math.max(0, Math.min(index, text.length));
	const kind = (char: string | undefined) =>
		char === undefined || char === "\n"
			? null
			: WORD_CHAR.test(char)
				? "word"
				: /\s/.test(char)
					? "space"
					: "other";
	// Prefer what follows the index, as a caret before a word selects it.
	const after = kind(text[at]);
	const before = kind(text[at - 1]);
	const target = after === "word" || before !== "word" ? after : before;
	if (target === null) {
		return before === null
			? { start: at, end: at }
			: { start: at - 1, end: at };
	}
	// Only `after` can be the one: `before` wins only as a word. An emoji
	// takes two code units.
	if (target === "other") {
		const size = (text.codePointAt(at) ?? 0) > 0xffff ? 2 : 1;
		return { start: at, end: at + size };
	}
	let start = at;
	let end = at;
	while (start > 0 && kind(text[start - 1]) === target) start--;
	while (end < text.length && kind(text[end]) === target) end++;
	return { start, end };
}

/** `selection` within a text `length` long, and in order. */
export function clampSelection(
	selection: TextSelection,
	length: number,
): TextSelection {
	const clamp = (index: number) => Math.max(0, Math.min(index, length));
	const start = clamp(selection.start);
	const end = clamp(selection.end);
	return start <= end ? { start, end } : { start: end, end: start };
}
