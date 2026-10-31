/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	averageColor,
	contrastingColor,
	isHexColor,
	mixColors,
	relativeLuminance,
} from "../color.ts";

describe("isHexColor", () => {
	test("is true only for #RRGGBB", () => {
		assert.equal(isHexColor("#0A84FF"), true);
		assert.equal(isHexColor("#0a84ff"), true);
		for (const value of ["#FFF", "0A84FF", "red", "", null, 0x0a84ff]) {
			assert.equal(isHexColor(value), false);
		}
	});
});

describe("averageColor", () => {
	test("averages opaque pixels evenly", () => {
		const pixels = [255, 0, 0, 255, 0, 0, 255, 255];
		assert.equal(averageColor(pixels), "#800080");
	});

	test("counts each pixel as much as it's opaque", () => {
		// A faint white pixel barely lightens an opaque black one.
		const pixels = [0, 0, 0, 255, 255, 255, 255, 0, 255, 255, 255, 51];
		assert.equal(averageColor(pixels), "#2B2B2B");
	});

	test("is null when every pixel is transparent", () => {
		assert.equal(averageColor([255, 0, 0, 0, 0, 255, 0, 0]), null);
		assert.equal(averageColor([]), null);
	});
});

describe("mixColors", () => {
	test("moves from one color toward another", () => {
		assert.equal(mixColors("#FF0000", "#FFFFFF", 0), "#FF0000");
		assert.equal(mixColors("#FF0000", "#FFFFFF", 0.5), "#FF8080");
		assert.equal(mixColors("#FF0000", "#FFFFFF", 1), "#FFFFFF");
	});

	test("leaves a color it can't read as it is", () => {
		assert.equal(mixColors("red", "#FFFFFF", 0.5), "red");
	});
});

describe("relativeLuminance", () => {
	test("returns 0 for black and 1 for white", () => {
		assert.equal(relativeLuminance("#000000"), 0);
		assert.equal(relativeLuminance("#FFFFFF"), 1);
	});

	test("matches standard primaries", () => {
		assert.ok(Math.abs(relativeLuminance("#FF0000") - 0.2126) < 1e-4);
		assert.ok(Math.abs(relativeLuminance("#00FF00") - 0.7152) < 1e-4);
		assert.ok(Math.abs(relativeLuminance("#0000FF") - 0.0722) < 1e-4);
	});

	test("returns 0 for invalid hex", () => {
		assert.equal(relativeLuminance("invalid"), 0);
	});
});

describe("contrastingColor", () => {
	test("picks black for light colors and white for dark colors", () => {
		assert.equal(contrastingColor("#FFFFFF"), "#000000");
		assert.equal(contrastingColor("#FFE433"), "#000000");
		assert.equal(contrastingColor("#FFFF00"), "#000000");

		assert.equal(contrastingColor("#000000"), "#FFFFFF");
		assert.equal(contrastingColor("#0000FF"), "#FFFFFF");
		assert.equal(contrastingColor("#808080"), "#FFFFFF");
	});
});
