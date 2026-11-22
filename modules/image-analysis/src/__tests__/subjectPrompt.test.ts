/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	AUTO_SUBJECT_POINTS,
	chooseSubjectMask,
	isPlausibleSubject,
	MAX_SUBJECT_AREA,
	MIN_SUBJECT_AREA,
	subjectMaskIndex,
	subjectMaskStats,
} from "../subjectPrompt.ts";

function grid(
	width: number,
	height: number,
	valueAt: (x: number, y: number) => number,
): Float32Array {
	const data = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) data[y * width + x] = valueAt(x, y);
	}
	return data;
}

describe("subjectMaskIndex", () => {
	test("the last confidence mask is the subject", () => {
		// MagicTouch lists background, then subject. One mask is that mask.
		assert.equal(subjectMaskIndex(0), null);
		assert.equal(subjectMaskIndex(1), 0);
		assert.equal(subjectMaskIndex(2), 1);
		assert.equal(subjectMaskIndex(3), 2);
	});
});

describe("subjectMaskStats", () => {
	test("measures an interior subject and ignores confidence below half", () => {
		const data = grid(4, 4, (x, y) =>
			x >= 1 && x <= 2 && y >= 1 && y <= 2 ? 1 : 0.49,
		);
		const stats = subjectMaskStats(data, 4, 4);
		assert.equal(stats.area, 4 / 16);
		assert.equal(stats.confidence, 1);
		assert.equal(stats.border, 0);
	});

	test("counts a pixel at exactly half as subject", () => {
		const data = grid(2, 2, () => 0.5);
		const stats = subjectMaskStats(data, 2, 2);
		assert.equal(stats.area, 1);
		assert.equal(stats.confidence, 0.5);
		assert.equal(stats.border, 1);
	});

	test("averages only subject pixels and counts the edge they cover", () => {
		const data = grid(4, 4, (x, y) => {
			if (y !== 0) return 0;
			return x === 1 ? 0.5 : 1;
		});
		const stats = subjectMaskStats(data, 4, 4);
		assert.equal(stats.area, 4 / 16);
		assert.equal(stats.confidence, (1 + 0.5 + 1 + 1) / 4);
		// The top row is four of the twelve edge pixels.
		assert.ok(Math.abs(stats.border - 4 / 12) < 1e-12);
	});

	test("an empty frame has no subject", () => {
		assert.deepEqual(subjectMaskStats(new Float32Array(), 0, 0), {
			area: 0,
			confidence: 0,
			border: 0,
		});
	});
});

describe("chooseSubjectMask", () => {
	test("auto prompts are the rule-of-thirds grid, center first", () => {
		assert.deepEqual(AUTO_SUBJECT_POINTS, [
			{ x: 0.5, y: 0.5 },
			{ x: 1 / 3, y: 1 / 3 },
			{ x: 0.5, y: 1 / 3 },
			{ x: 2 / 3, y: 1 / 3 },
			{ x: 1 / 3, y: 0.5 },
			{ x: 2 / 3, y: 0.5 },
			{ x: 1 / 3, y: 2 / 3 },
			{ x: 0.5, y: 2 / 3 },
			{ x: 2 / 3, y: 2 / 3 },
		]);
	});

	test("a speck or almost the whole frame is not a subject", () => {
		assert.equal(MIN_SUBJECT_AREA, 0.03);
		assert.equal(MAX_SUBJECT_AREA, 0.9);
		assert.equal(
			isPlausibleSubject({ area: 0.029, confidence: 1, border: 0 }),
			false,
		);
		assert.equal(
			isPlausibleSubject({ area: 0.03, confidence: 1, border: 0 }),
			true,
		);
		assert.equal(
			isPlausibleSubject({ area: 0.9, confidence: 1, border: 1 }),
			true,
		);
		assert.equal(
			isPlausibleSubject({ area: 0.91, confidence: 1, border: 1 }),
			false,
		);
	});

	test("returns null when every mask is a speck or the whole frame", () => {
		const chosen = chooseSubjectMask([
			{ mask: "speck", stats: { area: 0.01, confidence: 1, border: 0 } },
			{ mask: "frame", stats: { area: 0.97, confidence: 0.8, border: 1 } },
		]);
		assert.equal(chosen, null);
	});

	test("keeps a small sure horse instead of a wider, less sure tree line", () => {
		// Measured on a horse standing left of center: the center prompt
		// found the horse, and a point in the trees found a larger region.
		const chosen = chooseSubjectMask([
			{
				mask: "horse",
				stats: { area: 0.055, confidence: 0.991, border: 0 },
			},
			{
				mask: "trees",
				stats: { area: 0.331, confidence: 0.915, border: 0.058 },
			},
			{
				mask: "speck",
				stats: { area: 0.009, confidence: 0.965, border: 0 },
			},
		]);
		assert.equal(chosen, "horse");
	});

	test("an interior subject wins a close call against a mask on the border", () => {
		const chosen = chooseSubjectMask([
			{ mask: "sky", stats: { area: 0.55, confidence: 0.9, border: 0.8 } },
			{
				mask: "horse",
				stats: { area: 0.16, confidence: 0.88, border: 0.02 },
			},
		]);
		assert.equal(chosen, "horse");
	});

	test("a portrait that is clearly the surest mask is kept at the edge", () => {
		const chosen = chooseSubjectMask([
			{ mask: "blob", stats: { area: 0.05, confidence: 0.9, border: 0 } },
			{
				mask: "portrait",
				stats: { area: 0.58, confidence: 0.97, border: 0.72 },
			},
		]);
		assert.equal(chosen, "portrait");
	});

	test("the most confident plausible mask wins, and a tie keeps the larger", () => {
		assert.equal(
			chooseSubjectMask([
				{ mask: "rock", stats: { area: 0.3, confidence: 0.8, border: 0 } },
				{
					mask: "horse",
					stats: { area: 0.1, confidence: 0.95, border: 0 },
				},
			]),
			"horse",
		);
		assert.equal(
			chooseSubjectMask([
				{
					mask: "small",
					stats: { area: 0.1, confidence: 0.9, border: 0 },
				},
				{
					mask: "large",
					stats: { area: 0.2, confidence: 0.9, border: 0 },
				},
			]),
			"large",
		);
	});

	test("an empty list has no subject", () => {
		assert.equal(chooseSubjectMask([]), null);
	});
});
