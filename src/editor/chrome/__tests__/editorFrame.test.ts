/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cardBeside, editorFrame } from "../editorFrame.ts";

describe("editorFrame", () => {
	test("a phone keeps the dock", () => {
		assert.deepEqual(editorFrame(390, 844), {
			layersBeside: false,
			wide: false,
			inspectorPinned: false,
		});
	});

	test("a medium window puts the layers beside the canvas and keeps the dock", () => {
		assert.deepEqual(editorFrame(900, 800), {
			layersBeside: true,
			wide: false,
			inspectorPinned: false,
		});
	});

	test("a 13-inch laptop gets the rail, with the inspector closed until it's asked for", () => {
		for (const size of [
			[1024, 768],
			[1280, 800],
			[1440, 900],
			[1470, 860],
		] as const) {
			const frame = editorFrame(size[0], size[1]);
			assert.equal(frame.wide, true, `${size[0]}×${size[1]}`);
			assert.equal(frame.inspectorPinned, false, `${size[0]}×${size[1]}`);
		}
	});

	test("a tall window keeps the inspector open", () => {
		// An iPad Pro 13-inch in landscape, and a desktop window.
		for (const size of [
			[1376, 1032],
			[1440, 960],
			[1680, 1050],
		] as const) {
			const frame = editorFrame(size[0], size[1]);
			assert.equal(frame.wide, true, `${size[0]}×${size[1]}`);
			assert.equal(frame.inspectorPinned, true, `${size[0]}×${size[1]}`);
		}
	});
});

describe("cardBeside", () => {
	const inset = { left: 100, right: 8, bottom: 0 };
	const card = { cardWidth: 320, gap: 8 };

	test("a tall screenshot on a wide window takes the card at its side", () => {
		const left = cardBeside({
			documentSize: { width: 1170, height: 2532 },
			stage: { width: 1440, height: 844 },
			inset,
			...card,
		});
		// Fitted 820 tall, so 820 * 1170 / 2532 wide, centered in 1332 from 100.
		const photoWidth = (820 * 1170) / 2532;
		const photoRight = 100 + (1332 - photoWidth) / 2 + photoWidth;
		assert.ok(left !== null);
		assert.ok(Math.abs(left - (photoRight + 8)) < 1e-9);
		assert.ok(left + 320 <= 100 + 1332);
	});

	test("a landscape photo keeps the card along the bottom", () => {
		assert.equal(
			cardBeside({
				documentSize: { width: 4000, height: 3000 },
				stage: { width: 1440, height: 844 },
				inset,
				...card,
			}),
			null,
		);
	});

	test("a side too narrow for the card keeps it along the bottom", () => {
		assert.equal(
			cardBeside({
				documentSize: { width: 1000, height: 1000 },
				stage: { width: 1440, height: 844 },
				inset: { ...inset, right: 368 },
				...card,
			}),
			null,
		);
	});

	test("an unmeasured stage keeps the card along the bottom", () => {
		assert.equal(
			cardBeside({
				documentSize: { width: 1000, height: 3000 },
				stage: { width: 0, height: 0 },
				inset,
				...card,
			}),
			null,
		);
	});
});
