/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hexToHsv, hsvToHex, parseTypedHex } from "../hsv.ts";

describe("hsvToHex", () => {
	test("makes the primaries and secondaries around the hue circle", () => {
		const hues = [0, 60, 120, 180, 240, 300, 360].map((hue) =>
			hsvToHex({ hue, saturation: 1, value: 1 }),
		);
		assert.deepEqual(hues, [
			"#FF0000",
			"#FFFF00",
			"#00FF00",
			"#00FFFF",
			"#0000FF",
			"#FF00FF",
			"#FF0000",
		]);
	});

	test("fades to white without saturation, and to black without value", () => {
		assert.equal(hsvToHex({ hue: 200, saturation: 0, value: 1 }), "#FFFFFF");
		assert.equal(hsvToHex({ hue: 200, saturation: 1, value: 0 }), "#000000");
		assert.equal(hsvToHex({ hue: 0, saturation: 0, value: 0.5 }), "#808080");
	});
});

describe("hexToHsv", () => {
	test("round-trips a color through HSV", () => {
		for (const hex of ["#FF3B30", "#FFD60A", "#34C759", "#0A84FF", "#6B2FA0"]) {
			const hsv = hexToHsv(hex);
			assert.ok(hsv);
			assert.equal(hsvToHex(hsv), hex);
		}
	});

	test("reads either case", () => {
		assert.deepEqual(hexToHsv("#0a84ff"), hexToHsv("#0A84FF"));
	});

	test("gives grays the fallback hue", () => {
		assert.deepEqual(hexToHsv("#FFFFFF", 210), {
			hue: 210,
			saturation: 0,
			value: 1,
		});
		assert.deepEqual(hexToHsv("#000000", 30), {
			hue: 30,
			saturation: 0,
			value: 0,
		});
	});

	test("is null for anything but #RRGGBB", () => {
		for (const text of ["", "red", "#FFF", "#GGGGGG", "FF3B30"]) {
			assert.equal(hexToHsv(text), null);
		}
	});
});

describe("parseTypedHex", () => {
	test("reads six digits, with or without the #, in either case", () => {
		assert.equal(parseTypedHex("#0a84ff"), "#0A84FF");
		assert.equal(parseTypedHex("0A84FF"), "#0A84FF");
		assert.equal(parseTypedHex("  #0a84FF "), "#0A84FF");
	});

	test("doubles each of three digits, as CSS does", () => {
		assert.equal(parseTypedHex("#f80"), "#FF8800");
		assert.equal(parseTypedHex("abc"), "#AABBCC");
	});

	test("is null for anything else", () => {
		for (const text of ["", "#", "#12345", "#1234567", "#GG0000", "red"]) {
			assert.equal(parseTypedHex(text), null);
		}
	});
});
