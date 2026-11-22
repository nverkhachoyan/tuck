/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	AUTO_SUBJECT_POINTS,
	BORDER_SUBJECT_LIMIT,
	chooseSubjectMasks,
	isPlausibleSubject,
	MAX_SUBJECT_AREA,
	MIN_SUBJECT_AREA,
	type SubjectMaskStats,
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
		assert.equal(stats.columnSpan, 0.5);
		assert.equal(stats.rowSpan, 0.5);
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
			columnSpan: 0,
			rowSpan: 0,
		});
	});
});

function candidate(
	mask: string,
	stats: Partial<SubjectMaskStats> &
		Pick<SubjectMaskStats, "area" | "confidence">,
	occupancy?: number[],
) {
	return {
		mask,
		occupancy,
		stats: {
			border: 0,
			columnSpan: 0.3,
			rowSpan: 0.3,
			...stats,
		},
	};
}

describe("chooseSubjectMasks", () => {
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

	test("a speck, the whole frame, or a mask on the edge is not a subject", () => {
		assert.equal(MIN_SUBJECT_AREA, 0.01);
		assert.equal(MAX_SUBJECT_AREA, 0.9);
		assert.equal(BORDER_SUBJECT_LIMIT, 0.05);
		const inside = { confidence: 1, border: 0, columnSpan: 0.2, rowSpan: 0.2 };
		assert.equal(isPlausibleSubject({ area: 0.009, ...inside }), false);
		assert.equal(isPlausibleSubject({ area: 0.01, ...inside }), true);
		assert.equal(
			isPlausibleSubject({ area: 0.2, ...inside, border: 0.05 }),
			false,
		);
		assert.equal(
			isPlausibleSubject({ area: 0.2, ...inside, border: 0.049 }),
			true,
		);
		assert.equal(
			isPlausibleSubject({
				area: 0.4,
				confidence: 0.9,
				border: 0,
				columnSpan: 0.8,
				rowSpan: 0.4,
			}),
			false,
		);
		assert.equal(
			isPlausibleSubject({
				area: 0.4,
				confidence: 0.97,
				border: 0,
				columnSpan: 0.8,
				rowSpan: 0.9,
			}),
			true,
		);
	});

	test("returns nothing when every mask is a speck or the whole frame", () => {
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("speck", { area: 0.005, confidence: 1 }),
				candidate("frame", {
					area: 0.97,
					confidence: 0.8,
					border: 1,
					columnSpan: 1,
					rowSpan: 1,
				}),
			]),
			[],
		);
	});

	test("keeps the small interior horse and drops the hillside on the edge", () => {
		// Measured on the two horses on a grassy slope: the orange horse is
		// a small interior mask, and the forested hillside meets the edge.
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("hillside", {
					area: 0.163,
					confidence: 0.971,
					border: 0.071,
					columnSpan: 0.657,
					rowSpan: 0.663,
				}),
				candidate("grass", {
					area: 0.348,
					confidence: 0.953,
					border: 0.377,
					columnSpan: 1,
					rowSpan: 0.571,
				}),
				candidate("orange", {
					area: 0.015,
					confidence: 0.98,
					border: 0,
					columnSpan: 0.154,
					rowSpan: 0.202,
				}),
				candidate("trees", {
					area: 0.053,
					confidence: 0.913,
					border: 0,
					columnSpan: 0.319,
					rowSpan: 0.432,
				}),
			]),
			["orange"],
		);
	});

	test("drops a patch that only sits inside a wide background band", () => {
		// The band is the top row. The bush is two of those cells.
		const band = [1, 1, 1, 1, 0, 0, 0, 0];
		const bush = [1, 1, 0, 0, 0, 0, 0, 0];
		assert.deepEqual(
			chooseSubjectMasks([
				candidate(
					"band",
					{
						area: 0.147,
						confidence: 0.917,
						border: 0,
						columnSpan: 0.813,
						rowSpan: 0.465,
					},
					band,
				),
				candidate(
					"tree",
					{
						area: 0.269,
						confidence: 0.994,
						border: 0.247,
						columnSpan: 0.547,
						rowSpan: 0.719,
					},
					[0, 0, 0, 0, 1, 1, 1, 1],
				),
				candidate(
					"bush",
					{
						area: 0.04,
						confidence: 0.939,
						border: 0,
						columnSpan: 0.352,
						rowSpan: 0.247,
					},
					bush,
				),
			]),
			[],
		);
	});

	test("keeps a centered dog that fills much of the frame without meeting the edge", () => {
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("dog", {
					area: 0.357,
					confidence: 0.997,
					border: 0,
					columnSpan: 0.588,
					rowSpan: 0.924,
				}),
			]),
			["dog"],
		);
	});

	test("combines overlapping prompts of one subject and leaves another out", () => {
		const body = [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0];
		const head = [0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0];
		const other = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0];
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("body", { area: 0.04, confidence: 0.97 }, body),
				candidate("head", { area: 0.03, confidence: 0.99 }, head),
				candidate("other", { area: 0.02, confidence: 0.9 }, other),
			]),
			["body", "head"],
		);
	});

	test("the most confident interior mask wins, and a tie keeps the larger", () => {
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("rock", { area: 0.3, confidence: 0.8 }),
				candidate("horse", { area: 0.1, confidence: 0.95 }),
			]),
			["horse"],
		);
		assert.deepEqual(
			chooseSubjectMasks([
				candidate("small", { area: 0.1, confidence: 0.9 }),
				candidate("large", { area: 0.2, confidence: 0.9 }),
			]),
			["large"],
		);
	});

	test("an empty list has no subject", () => {
		assert.deepEqual(chooseSubjectMasks([]), []);
	});
});
