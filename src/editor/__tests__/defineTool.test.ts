/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defineTool, editorTools } from "../defineTool.ts";

const ruler = defineTool({
	spec: {
		target: "none",
		tray: false,
		sized: false,
		label: "Ruler",
		icon: "ruler",
		key: "U",
		shortcut: "Measure",
		actsOn: () => false,
	},
	useController: () => null,
	views: { Dock: () => null },
});

describe("editorTools", () => {
	test("hands over the tools and the toolbar as they are", () => {
		const tools = { ruler };
		const config = editorTools({ tools, toolbar: ["ruler", "text"] });
		assert.equal(config.tools, tools);
		assert.deepEqual(config.toolbar, ["ruler", "text"]);
	});

	test("takes only tools in the list, and no id the editor uses", () => {
		// @ts-expect-error: the toolbar names a tool that isn't in the list.
		editorTools({ tools: { ruler }, toolbar: ["rular"] });
		// @ts-expect-error: "text" is the editor's own entry.
		editorTools({ tools: { text: ruler }, toolbar: [] });
	});
});
