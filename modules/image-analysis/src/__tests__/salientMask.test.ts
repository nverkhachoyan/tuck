/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	evaluateSalientMask,
	MAX_SALIENT_AREA,
	MIN_SALIENT_AREA,
} from "../salientMask.ts";

function filledMask(
	total: number,
	foregroundCount: number,
	fgValue = 0.95,
	bgValue = 0.05,
): Float32Array {
	const mask = new Float32Array(total);
	mask.fill(bgValue);
	for (let i = 0; i < foregroundCount; i++) mask[i] = fgValue;
	return mask;
}

describe("evaluateSalientMask", () => {
	test("rejects an empty mask or a scene with low confidence everywhere", () => {
		assert.deepEqual(evaluateSalientMask(new Float32Array(0)), {
			hasSubject: false,
			area: 0,
			maxConfidence: 0,
		});
		const meadow = new Float32Array(1000).fill(0.33);
		const result = evaluateSalientMask(meadow);
		assert.equal(result.hasSubject, false);
		assert.equal(result.area, 0);
		assert.ok(Math.abs(result.maxConfidence - 0.33) < 1e-5);
	});

	test("rejects stray noise specks below MIN_SALIENT_AREA", () => {
		const total = 10000;
		const speckCount = Math.floor(total * MIN_SALIENT_AREA) - 1;
		const result = evaluateSalientMask(filledMask(total, speckCount));
		assert.equal(result.hasSubject, false);
	});

	test("accepts small real off-center subjects (~1.3–1.5% of frame)", () => {
		const result = evaluateSalientMask(filledMask(10000, 130));
		assert.equal(result.hasSubject, true);
		assert.equal(result.area, 0.013);
	});

	test("accepts a typical subject and a large subject touching edges", () => {
		const dog = evaluateSalientMask(filledMask(1000, 357));
		assert.equal(dog.hasSubject, true);
		const car = evaluateSalientMask(filledMask(1000, 540));
		assert.equal(car.hasSubject, true);
	});

	test("rejects a near-full-frame mask above MAX_SALIENT_AREA", () => {
		const total = 1000;
		const fullCount = Math.ceil(total * MAX_SALIENT_AREA) + 1;
		const result = evaluateSalientMask(filledMask(total, fullCount));
		assert.equal(result.hasSubject, false);
	});

	test("clamps out-of-range values into [0, 1]", () => {
		const result = evaluateSalientMask(new Float32Array([1.5, -0.2, 0.9, 0.1]));
		assert.equal(result.hasSubject, true);
		assert.equal(result.maxConfidence, 1);
		assert.equal(result.area, 0.5);
	});
});
