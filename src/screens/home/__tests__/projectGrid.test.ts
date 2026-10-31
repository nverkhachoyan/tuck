/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	displayLabel,
	formatDate,
	GRID_GAP,
	GRID_PADDING,
	gridLayout,
	HOME_MAX_WIDTH,
} from "../projectGrid.ts";

describe("gridLayout", () => {
	it("never exceeds the inner grid width across integer and fractional widths", () => {
		for (const width of [
			240, 320, 375, 390, 560, 742.4, 820, 1009, 1065, 1080, 1440,
		]) {
			const { columns, cardWidth } = gridLayout(width);
			const inner = Math.min(width, HOME_MAX_WIDTH) - GRID_PADDING * 2;
			const rowWidth = columns * cardWidth + GRID_GAP * (columns - 1);
			assert.ok(
				rowWidth <= inner,
				`rowWidth ${rowWidth} exceeded inner ${inner} at width ${width}`,
			);
			assert.ok(columns >= 1 && columns <= 5);
		}
	});

	it("scales from 2 columns on phones to 5 columns on wide screens", () => {
		assert.equal(gridLayout(390).columns, 2);
		assert.equal(gridLayout(768).columns, 4);
		assert.equal(gridLayout(1080).columns, 5);
		assert.equal(gridLayout(1600).columns, 5);
	});
});

describe("displayLabel", () => {
	it("converts all-caps captions to sentence case while keeping mixed case", () => {
		assert.equal(displayLabel("WHEN CODE WORKS"), "When code works");
		assert.equal(displayLabel("iPhone 16 screenshot"), "iPhone 16 screenshot");
		assert.equal(displayLabel("2026-10-31"), "2026-10-31");
	});
});

describe("formatDate", () => {
	const now = new Date(2026, 9, 31, 15, 30);

	it("formats today, yesterday, same year, and prior years", () => {
		assert.match(
			formatDate(new Date(2026, 9, 31, 9, 15).getTime(), now),
			/^Today, /,
		);
		assert.equal(
			formatDate(new Date(2026, 9, 30, 22, 0).getTime(), now),
			"Yesterday",
		);
		const sameYear = formatDate(new Date(2026, 4, 12, 12, 0).getTime(), now);
		assert.doesNotMatch(sameYear, /2026/);
		const lastYear = formatDate(new Date(2025, 11, 25, 12, 0).getTime(), now);
		assert.match(lastYear, /2025/);
	});
});
