/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	ENCODER_SIDE,
	planObjectCrop,
	REFINED_MASK_MAX_SIDE,
} from "../objectCrop.ts";

describe("planObjectCrop", () => {
	test("plans a 2048-capped mask and aligned crop for a small object in a large photo", () => {
		const plan = planObjectCrop(
			{ width: 4000, height: 3000 },
			{ x: 0.4, y: 0.3, width: 0.1, height: 0.1 },
		);
		assert.ok(plan !== null);
		assert.deepEqual(plan.output, {
			width: REFINED_MASK_MAX_SIDE,
			height: 1536,
		});

		const { paste, source, encode, promptBox, output } = plan;
		assert.ok(Number.isInteger(paste.x) && Number.isInteger(paste.y));
		assert.ok(Number.isInteger(paste.width) && Number.isInteger(paste.height));
		assert.ok(paste.x >= 0 && paste.y >= 0);
		assert.ok(paste.x + paste.width <= output.width);
		assert.ok(paste.y + paste.height <= output.height);

		assert.equal(Math.max(encode.width, encode.height), ENCODER_SIDE);
		assert.ok(
			Math.abs(source.width / source.height - paste.width / paste.height) <
				0.01,
		);
		assert.ok(
			Math.abs(encode.width / encode.height - paste.width / paste.height) <
				0.01,
		);

		const [left, top, right, bottom] = promptBox;
		assert.ok(
			left > 0 && top > 0 && right < encode.width && bottom < encode.height,
		);
		assert.ok(left < right && top < bottom);
	});

	test("pads tall thin boxes equally on all sides in source pixels", () => {
		const plan = planObjectCrop(
			{ width: 4000, height: 3000 },
			{ x: 0.5, y: 0.4, width: 0.03, height: 0.12 },
		);
		assert.ok(plan !== null);
		// Box is 120x360 px -> pad is 36 px each side -> ~192x432 px source crop.
		assert.ok(plan.source.width >= 190 && plan.source.width <= 200);
		assert.ok(plan.source.height >= 430 && plan.source.height <= 440);
	});

	test("returns null when the padded crop exceeds half the photo's longer side", () => {
		assert.equal(
			planObjectCrop(
				{ width: 4000, height: 3000 },
				{ x: 0.1, y: 0.1, width: 0.45, height: 0.45 },
			),
			null,
		);
	});

	test("clamps boxes touching edges and corners inside source and output bounds", () => {
		const corners = [
			{ x: 0, y: 0, width: 0.1, height: 0.1 },
			{ x: 0.9, y: 0, width: 0.1, height: 0.1 },
			{ x: 0, y: 0.9, width: 0.1, height: 0.1 },
			{ x: 0.9, y: 0.9, width: 0.1, height: 0.1 },
		];
		for (const box of corners) {
			const plan = planObjectCrop({ width: 3000, height: 2000 }, box);
			assert.ok(plan !== null);
			assert.ok(plan.source.x >= 0 && plan.source.y >= 0);
			assert.ok(plan.source.x + plan.source.width <= 3000);
			assert.ok(plan.source.y + plan.source.height <= 2000);
			assert.ok(plan.paste.x >= 0 && plan.paste.y >= 0);
			assert.ok(plan.paste.x + plan.paste.width <= plan.output.width);
			assert.ok(plan.paste.y + plan.paste.height <= plan.output.height);
			const [left, top, right, bottom] = plan.promptBox;
			assert.ok(left >= 0 && top >= 0);
			assert.ok(right <= plan.encode.width && bottom <= plan.encode.height);
		}
	});

	test("never upscales the output mask beyond the source photo's size", () => {
		const plan = planObjectCrop(
			{ width: 800, height: 600 },
			{ x: 0.4, y: 0.4, width: 0.15, height: 0.15 },
		);
		assert.ok(plan !== null);
		assert.deepEqual(plan.output, { width: 800, height: 600 });
	});

	test("returns null for degenerate or tiny crops", () => {
		assert.equal(
			planObjectCrop(
				{ width: 4000, height: 3000 },
				{ x: 0.2, y: 0.2, width: 0, height: 0.1 },
			),
			null,
		);
		assert.equal(
			planObjectCrop(
				{ width: 4000, height: 3000 },
				{ x: 0.2, y: 0.2, width: 0.001, height: 0.001 },
			),
			null,
		);
		assert.equal(
			planObjectCrop(
				{ width: 0, height: 3000 },
				{ x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
			),
			null,
		);
	});
});
