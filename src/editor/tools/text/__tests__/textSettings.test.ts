/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultTextStyle } from "../../../layers/text/text.ts";
import { parseTextStyle, withTextEdit } from "../textSettings.ts";

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
