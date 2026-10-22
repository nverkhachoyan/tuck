/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	type Adjustments,
	adjustmentMatrix,
	adjustmentsEqual,
	type ColorMatrix,
	concatColorMatrices,
	isNeutral,
	neutralAdjustments,
} from "../adjustments.ts";

type Color = [number, number, number, number];

function apply(matrix: ColorMatrix, color: Color): Color {
	return [0, 1, 2, 3].map(
		(row) =>
			color.reduce((sum, value, k) => sum + matrix[row * 5 + k] * value, 0) +
			matrix[row * 5 + 4],
	) as Color;
}

function adjusted(adjustments: Partial<Adjustments>, color: Color): Color {
	return apply(
		adjustmentMatrix({ ...neutralAdjustments, ...adjustments }),
		color,
	);
}

function assertColor(actual: Color, expected: Color) {
	for (let i = 0; i < 4; i++) {
		assert.ok(
			Math.abs(actual[i] - expected[i]) < 1e-9,
			`${actual} ≠ ${expected}`,
		);
	}
}

const gray: Color = [0.5, 0.5, 0.5, 1];
const orange: Color = [0.9, 0.5, 0.2, 1];

describe("adjustmentMatrix", () => {
	test("is the identity with no adjustments", () => {
		// biome-ignore format: a matrix reads best in rows
		assert.deepEqual(adjustmentMatrix(neutralAdjustments), [
			1, 0, 0, 0, 0,
			0, 1, 0, 0, 0,
			0, 0, 1, 0, 0,
			0, 0, 0, 1, 0,
		]);
	});

	test("brightness shifts every channel alike", () => {
		assertColor(adjusted({ brightness: 1 }, gray), [0.9, 0.9, 0.9, 1]);
		assertColor(adjusted({ brightness: -0.5 }, gray), [0.3, 0.3, 0.3, 1]);
	});

	test("contrast leaves mid-gray, and at -1 flattens everything to it", () => {
		assertColor(adjusted({ contrast: 0.7 }, gray), gray);
		assertColor(adjusted({ contrast: -1 }, orange), gray);
		assertColor(
			adjusted({ contrast: 1 }, [0.6, 0.4, 0.5, 1]),
			[0.7, 0.3, 0.5, 1],
		);
	});

	test("saturation at -1 is black and white, and leaves grays alone", () => {
		const [r, g, b] = adjusted({ saturation: -1 }, orange);
		assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9);
		for (const saturation of [-1, -0.3, 0.6, 1]) {
			assertColor(
				adjusted({ saturation }, [0.2, 0.2, 0.2, 1]),
				[0.2, 0.2, 0.2, 1],
			);
		}
	});

	test("saturation above 0 pushes channels apart", () => {
		const [r, , b] = adjusted({ saturation: 1 }, orange);
		assert.ok(r > orange[0] && b < orange[2]);
	});

	test("warmth adds red and takes blue, and coolness the reverse", () => {
		const [warmR, warmG, warmB] = adjusted({ temperature: 1 }, gray);
		assert.ok(warmR > 0.5 && warmB < 0.5);
		assert.equal(warmG, 0.5);
		const [coolR, , coolB] = adjusted({ temperature: -1 }, gray);
		assert.ok(coolR < 0.5 && coolB > 0.5);
		assertColor(adjusted({ temperature: 1 }, [0, 0, 0, 1]), [0, 0, 0, 1]);
	});

	test("leaves alpha alone", () => {
		const all = { brightness: 1, contrast: 1, saturation: 1, temperature: 1 };
		assert.equal(adjusted(all, [0.3, 0.6, 0.9, 0.25])[3], 0.25);
		assert.equal(adjusted(all, [0, 0, 0, 0])[3], 0);
	});

	test("is each adjustment applied in turn", () => {
		const all = {
			brightness: 0.2,
			contrast: -0.4,
			saturation: 0.5,
			temperature: -0.6,
		};
		let color = orange;
		for (const step of [
			{ temperature: all.temperature },
			{ brightness: all.brightness },
			{ contrast: all.contrast },
			{ saturation: all.saturation },
		]) {
			color = adjusted(step, color);
		}
		assertColor(adjusted(all, orange), color);
	});

	test("clamps values past ±1", () => {
		assert.deepEqual(
			adjustmentMatrix({ ...neutralAdjustments, brightness: 3 }),
			adjustmentMatrix({ ...neutralAdjustments, brightness: 1 }),
		);
	});
});

describe("concatColorMatrices", () => {
	test("applies the second argument first", () => {
		const double = adjustmentMatrix({ ...neutralAdjustments, contrast: 1 });
		const lift = adjustmentMatrix({ ...neutralAdjustments, brightness: 0.25 });
		assertColor(
			apply(concatColorMatrices(double, lift), gray),
			[0.7, 0.7, 0.7, 1],
		);
	});
});

describe("isNeutral and adjustmentsEqual", () => {
	test("compare every adjustment", () => {
		assert.equal(isNeutral(neutralAdjustments), true);
		assert.equal(isNeutral({ ...neutralAdjustments, saturation: 0.01 }), false);
		assert.equal(
			adjustmentsEqual(neutralAdjustments, { ...neutralAdjustments }),
			true,
		);
		assert.equal(
			adjustmentsEqual(neutralAdjustments, {
				...neutralAdjustments,
				temperature: -0.2,
			}),
			false,
		);
	});
});
