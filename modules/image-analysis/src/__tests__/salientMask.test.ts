/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	evaluateSalientMask,
	MAX_REFINED_BOXES,
	MAX_SALIENT_AREA,
	MIN_SALIENT_AREA,
	maskAgreementIoU,
	salientSubjectBoxes,
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

function paintRect(
	mask: Float32Array,
	side: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	value = 0.95,
) {
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			mask[y * side + x] = value;
		}
	}
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

describe("salientSubjectBoxes", () => {
	test("finds a single off-center subject box", () => {
		const side = 100;
		const mask = new Float32Array(side * side);
		paintRect(mask, side, 70, 40, 85, 65);
		const boxes = salientSubjectBoxes(mask, side);
		assert.deepEqual(boxes, [{ x: 0.7, y: 0.4, width: 0.15, height: 0.25 }]);
	});

	test("merges nearby split pieces of one subject into one box", () => {
		const side = 100;
		const mask = new Float32Array(side * side);
		// Handlebar above frame with a 2-pixel gap
		paintRect(mask, side, 40, 30, 60, 36);
		paintRect(mask, side, 36, 38, 80, 75);
		const boxes = salientSubjectBoxes(mask, side);
		assert.equal(boxes.length, 1);
		assert.deepEqual(boxes[0], {
			x: 0.36,
			y: 0.3,
			width: 0.44,
			height: 0.45,
		});
	});

	test("keeps separated subjects as distinct boxes, largest first", () => {
		const side = 100;
		const mask = new Float32Array(side * side);
		paintRect(mask, side, 5, 10, 15, 25); // 150 px
		paintRect(mask, side, 70, 50, 90, 80); // 600 px
		const boxes = salientSubjectBoxes(mask, side);
		assert.equal(boxes.length, 2);
		assert.deepEqual(boxes[0], { x: 0.7, y: 0.5, width: 0.2, height: 0.3 });
		assert.deepEqual(boxes[1], { x: 0.05, y: 0.1, width: 0.1, height: 0.15 });
	});

	test("drops tiny specks and caps the number of returned boxes", () => {
		const side = 100;
		const mask = new Float32Array(side * side);
		// 6 well-separated 5×5 blocks (0.25% each) plus a 2×2 speck (0.04%)
		paintRect(mask, side, 0, 0, 2, 2);
		for (let i = 0; i < 6; i++) {
			const x = (i % 3) * 35 + 5;
			const y = Math.floor(i / 3) * 50 + 10;
			paintRect(mask, side, x, y, x + 5, y + 5);
		}
		const boxes = salientSubjectBoxes(mask, side);
		assert.equal(boxes.length, MAX_REFINED_BOXES);
	});
});

describe("maskAgreementIoU", () => {
	test("computes IoU between probability map and RGBA mask pixels", () => {
		const probs = new Float32Array([0.9, 0.9, 0.1, 0.1]);
		// 1st pixel agrees FG, 2nd missed, 3rd extra FG, 4th agrees BG -> 1/3
		const rgba = new Uint8ClampedArray([
			255, 255, 255, 255, 0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255,
		]);
		assert.ok(Math.abs(maskAgreementIoU(probs, rgba, 4) - 1 / 3) < 1e-6);
	});

	test("returns 1 for identical masks and 0 for empty masks", () => {
		const probs = new Float32Array([0.8, 0.2, 0.9, 0.1]);
		const rgba = new Uint8ClampedArray([
			255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255,
		]);
		assert.equal(maskAgreementIoU(probs, rgba, 4), 1);
		assert.equal(
			maskAgreementIoU(new Float32Array(4), new Uint8ClampedArray(16), 4),
			0,
		);
	});
});
