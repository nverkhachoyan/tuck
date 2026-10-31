/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultTextStyle } from "../../../layers/text/text.ts";
import { NEXT_ALIGN, parseTextStyle, withTextEdit } from "../textSettings.ts";

describe("NEXT_ALIGN", () => {
	test("cycles left to center to right to left", () => {
		assert.equal(NEXT_ALIGN.left, "center");
		assert.equal(NEXT_ALIGN.center, "right");
		assert.equal(NEXT_ALIGN.right, "left");
	});
});

describe("parseTextStyle", () => {
	test("starts from the default with nothing saved", () => {
		assert.deepEqual(parseTextStyle(undefined), defaultTextStyle);
		assert.deepEqual(parseTextStyle("serif"), defaultTextStyle);
	});

	test("keeps a valid saved style, outline and box off included", () => {
		const style = {
			font: "typewriter",
			color: "#FF3B30",
			outlineColor: null,
			backgroundColor: "#000000",
			align: "left",
		};
		assert.deepEqual(parseTextStyle(style), style);
	});

	test("replaces each invalid part with the default's", () => {
		assert.deepEqual(
			parseTextStyle({
				font: "comic",
				color: "red",
				outlineColor: 3,
				align: "justify",
			}),
			defaultTextStyle,
		);
	});
});

describe("withTextEdit", () => {
	test("takes the style an edit changed, but not its text", () => {
		const style = withTextEdit(defaultTextStyle, {
			text: "hello",
			font: "marker",
			outlineColor: null,
		});
		assert.deepEqual(style, {
			...defaultTextStyle,
			font: "marker",
			outlineColor: null,
		});
		assert.equal("text" in style, false);
	});
});
