/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { caretText, clampSelection, wordRange } from "./textEditing.ts";

describe("caretText", () => {
	test("leaves text without empty lines as it is", () => {
		const { caretText: text, toCaret, fromCaret } = caretText("ab\ncd");
		assert.equal(text, "ab\ncd");
		assert.deepEqual(toCaret, [0, 1, 2, 3, 4, 5]);
		assert.deepEqual(fromCaret, [0, 1, 2, 3, 4, 5]);
	});

	test("gives empty text a filler", () => {
		const { caretText: text, toCaret, fromCaret } = caretText("");
		assert.equal(text, ".");
		assert.deepEqual(toCaret, [0]);
		assert.deepEqual(fromCaret, [0, 0]);
	});

	test("puts a filler on each empty line, with the caret before it", () => {
		const { caretText: text, toCaret, fromCaret } = caretText("a\n\nb\n");
		assert.equal(text, "a\n.\nb\n.");
		// a, \n, (filler) \n, b, \n, (filler) end
		assert.deepEqual(toCaret, [0, 1, 2, 4, 5, 6]);
		assert.equal(fromCaret.length, text.length + 1);
		// Either side of a filler is the empty line.
		assert.equal(fromCaret[2], 2);
		assert.equal(fromCaret[3], 2);
		assert.equal(fromCaret[6], 5);
		assert.equal(fromCaret[7], 5);
	});

	test("round-trips every index of the text", () => {
		const text = "\nhello\n\n\nworld\n";
		const { toCaret, fromCaret } = caretText(text);
		for (let i = 0; i <= text.length; i++) {
			assert.equal(fromCaret[toCaret[i]], i);
		}
	});
});

describe("wordRange", () => {
	const text = "hello big   world!";

	test("selects the word a caret is before, inside, or after", () => {
		assert.deepEqual(wordRange(text, 0), { start: 0, end: 5 });
		assert.deepEqual(wordRange(text, 2), { start: 0, end: 5 });
		assert.deepEqual(wordRange(text, 5), { start: 0, end: 5 });
		assert.deepEqual(wordRange(text, 6), { start: 6, end: 9 });
	});

	test("selects a run of spaces between words", () => {
		assert.deepEqual(wordRange(text, 10), { start: 9, end: 12 });
	});

	test("selects punctuation on its own", () => {
		assert.deepEqual(wordRange(text, 18), { start: 17, end: 18 });
		assert.deepEqual(wordRange("a!!", 1), { start: 0, end: 1 });
		assert.deepEqual(wordRange("!!", 0), { start: 0, end: 1 });
	});

	test("keeps apostrophes in words", () => {
		assert.deepEqual(wordRange("don't go", 1), { start: 0, end: 5 });
	});

	test("selects a whole emoji", () => {
		assert.deepEqual(wordRange("a 😀", 2), { start: 2, end: 4 });
	});

	test("selects nothing on an empty line", () => {
		assert.deepEqual(wordRange("a\n\nb", 2), { start: 2, end: 2 });
		assert.deepEqual(wordRange("", 0), { start: 0, end: 0 });
	});
});

describe("clampSelection", () => {
	test("keeps a selection inside the text, in order", () => {
		assert.deepEqual(clampSelection({ start: 8, end: 2 }, 5), {
			start: 2,
			end: 5,
		});
		assert.deepEqual(clampSelection({ start: -1, end: 3 }, 5), {
			start: 0,
			end: 3,
		});
	});
});
