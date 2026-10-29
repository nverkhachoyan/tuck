/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { averageColor, isHexColor, mixColors } from "../color.ts";

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
