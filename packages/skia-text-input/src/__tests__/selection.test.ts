/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clampSelection, wordRange } from "../selection.ts";

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
