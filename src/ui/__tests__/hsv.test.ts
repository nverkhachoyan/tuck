/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	hexToHsv,
	hsvToHex,
	hsvToTone,
	parseTypedHex,
	toneGradientCss,
	toneToHsv,
} from "../hsv.ts";

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

describe("tone math", () => {
	test("round-trips tone values through HSV", () => {
		for (const tone of [0, 0.25, 0.5, 0.75, 1]) {
			const hsv = toneToHsv(180, tone);
			const roundTrip = hsvToTone(hsv);
			assert.ok(
				Math.abs(roundTrip - tone) < 1e-6,
				`Expected ${tone}, got ${roundTrip}`,
			);
		}
	});

	test("maps white, pure hue, and black to 0, 0.5, and 1", () => {
		assert.equal(hsvToHex(toneToHsv(0, 0)), "#FFFFFF");
		assert.equal(hsvToHex(toneToHsv(0, 0.5)), "#FF0000");
		assert.equal(hsvToHex(toneToHsv(0, 1)), "#000000");

		assert.equal(hsvToTone({ hue: 0, saturation: 0, value: 1 }), 0);
		assert.equal(hsvToTone({ hue: 0, saturation: 1, value: 1 }), 0.5);
		assert.equal(hsvToTone({ hue: 0, saturation: 1, value: 0 }), 1);
		assert.equal(hsvToTone({ hue: 0, saturation: 0, value: 0 }), 1);
	});

	test("maps grays to inverse brightness smoothly", () => {
		const midGray = hexToHsv("#808080");
		assert.ok(midGray);
		assert.ok(Math.abs(hsvToTone(midGray) - 0.5) < 0.01);

		const darkGray = hexToHsv("#1A1A1A");
		assert.ok(darkGray);
		assert.ok(Math.abs(hsvToTone(darkGray) - 0.9) < 0.01);
	});

	test("clamps out-of-range tones to [0, 1]", () => {
		assert.deepEqual(toneToHsv(100, -0.5), toneToHsv(100, 0));
		assert.deepEqual(toneToHsv(100, 1.5), toneToHsv(100, 1));
	});

	test("formats CSS tone gradient with opaque stops", () => {
		assert.equal(
			toneGradientCss("#0A84FF"),
			"linear-gradient(to right, #FFFFFF 0%, #0A84FF 50%, #000000 100%)",
		);
	});
});
