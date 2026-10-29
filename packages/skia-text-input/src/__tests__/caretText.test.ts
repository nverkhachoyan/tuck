/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { caretText } from "../caretText.ts";

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
