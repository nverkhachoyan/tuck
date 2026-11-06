/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addStroke } from "../../strokes.ts";
import { createDrawingLayer, type Stroke } from "../drawing.ts";
import {
	continuesMark,
	MARK_GAP,
	MARK_NEAR_GAP,
	MARK_NEAR_PAUSE_MS,
	MARK_PAUSE_MS,
	markGap,
	sameStyle,
} from "../marks.ts";

const pen = (
	points: number[],
	extra: Partial<Stroke & { type: "pen" }> = {},
): Stroke & { type: "pen" } => ({
	type: "pen",
	color: "#1C1C1E",
	width: 5,
	points,
	...extra,
});

// An arrow's shaft along y 0, from x 0 to 100, ended at t 0.
const shaft = () => createDrawingLayer(pen([0, 0, 100, 0]));
const lastOf = (id: string, endedAt = 0) => ({ markId: id, endedAt });

describe("continuesMark", () => {
	test("an arrow's head 300 ms after its shaft, from its end, is one mark", () => {
		const mark = shaft();
		const head = pen([100, 0, 85, -10]);
		assert.equal(continuesMark(mark, lastOf(mark.id), head, 300), true);
	});

	test("a circle 1.5 s later, elsewhere, is a new mark", () => {
		const mark = shaft();
		const circle = pen([400, 300, 420, 320]);
		assert.equal(continuesMark(mark, lastOf(mark.id), circle, 1500), false);
	});

	test("touching the mark after a long pause starts a new one", () => {
		const mark = shaft();
		const touching = pen([50, 0, 50, 40]);
		const pause = MARK_NEAR_PAUSE_MS + 500;
		assert.equal(continuesMark(mark, lastOf(mark.id), touching, pause), false);
	});

	test("right after, but further than MARK_GAP, is a new mark; close after a longer pause continues", () => {
		const mark = shaft();
		// The ink reaches 2.5 from the line; MARK_GAP widths past that is 32.5.
		const far = pen([50, 2.5 + (MARK_GAP + 1) * 5, 60, 60]);
		assert.equal(continuesMark(mark, lastOf(mark.id), far, 100), false);
		const close = pen([50, 2.5 + MARK_NEAR_GAP * 5 - 1, 60, 30]);
		const pause = (MARK_PAUSE_MS + MARK_NEAR_PAUSE_MS) / 2;
		assert.equal(continuesMark(mark, lastOf(mark.id), close, pause), true);
		const middling = pen([50, 2.5 + 3 * 5, 60, 30]);
		assert.equal(continuesMark(mark, lastOf(mark.id), middling, pause), false);
	});

	test("a color or tip change starts a new mark; a size change doesn't", () => {
		const mark = shaft();
		const last = lastOf(mark.id);
		const at = [100, 0, 120, 0];
		assert.equal(
			continuesMark(mark, last, pen(at, { color: "#FF3B30" }), 200),
			false,
		);
		assert.equal(
			continuesMark(mark, last, pen(at, { tip: "marker" }), 200),
			false,
		);
		assert.equal(continuesMark(mark, last, pen(at, { width: 12 }), 200), true);
	});

	test("never continues another mark, a locked one, or with no last stroke", () => {
		const mark = shaft();
		const next = pen([100, 0, 120, 0]);
		assert.equal(continuesMark(mark, lastOf("other"), next, 200), false);
		assert.equal(
			continuesMark({ ...mark, locked: true }, lastOf(mark.id), next, 200),
			false,
		);
		assert.equal(continuesMark(mark, null, next, 200), false);
	});

	test("ink the Eraser cleared isn't near", () => {
		const whole = shaft();
		const erased = addStroke(whole, {
			type: "eraser",
			width: 100,
			points: [100, 0],
		});
		// The ink now ends at x 50; x 110 is 60 from it.
		const next = pen([110, 0, 130, 0]);
		assert.equal(continuesMark(whole, lastOf(whole.id), next, 200), true);
		assert.equal(continuesMark(erased, lastOf(erased.id), next, 200), false);
	});
});

describe("markGap", () => {
	test("gives the pause and the gap in widths, on the ink or past MARK_GAP", () => {
		const mark = shaft();
		assert.deepEqual(markGap(mark, lastOf(mark.id, 100), pen([50, 0]), 400), {
			pause: 300,
			gap: 0,
		});
		assert.equal(
			markGap(mark, lastOf(mark.id), pen([50, 200]), 0).gap,
			Infinity,
		);
	});
});

describe("sameStyle", () => {
	test("compares tip and color, not size or case", () => {
		assert.equal(
			sameStyle(pen([]), pen([], { color: "#1c1c1e", width: 9 })),
			true,
		);
		assert.equal(sameStyle(pen([]), { type: "eraser", width: 5 }), false);
	});
});
