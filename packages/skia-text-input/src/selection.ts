/** A range of a text, in UTF-16 code units, `start <= end`. */
export type TextSelection = { start: number; end: number };

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
