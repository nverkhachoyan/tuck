/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	type DockPanel,
	type ModeChromeInput,
	modeChrome,
	railChosenTool,
} from "../editorChrome.ts";
import type { EditorTool } from "../editorMode.ts";

const nothing: ModeChromeInput = {
	tool: null,
	editingText: false,
	styledText: false,
	layerName: null,
	findChosen: 0,
	wide: false,
};

const TOOLS: [EditorTool, string][] = [
	["draw", "Draw"],
	["redact", "Redact"],
	["find", "Find"],
	["adjust", "Adjust"],
	["cutOut", "Cut out"],
];

describe("modeChrome", () => {
	test("a tool's Cancel and Done are the tool's", () => {
		for (const [tool, title] of TOOLS) {
			assert.deepEqual(
				modeChrome({ ...nothing, tool }),
				{
					panel: tool,
					actions: {
						title,
						cancel: "tool",
						done: "tool",
						doneLabel: undefined,
					},
					inBar: false,
				},
				tool,
			);
		}
	});

	test("the open tool comes before the selected layer", () => {
		const chrome = modeChrome({
			...nothing,
			tool: "draw",
			styledText: true,
			layerName: "Text",
		});
		assert.equal(chrome.panel, "draw");
		assert.equal(chrome.actions?.title, "Draw");
	});

	test("Find's Done names the regions it redacts once some are chosen", () => {
		assert.equal(
			modeChrome({ ...nothing, tool: "find" }).actions?.doneLabel,
			undefined,
		);
		assert.equal(
			modeChrome({ ...nothing, tool: "find", findChosen: 3 }).actions
				?.doneLabel,
			"Redact 3 chosen",
		);
	});

	test("only Find's Done takes a label", () => {
		assert.equal(
			modeChrome({ ...nothing, tool: "redact", findChosen: 3 }).actions
				?.doneLabel,
			undefined,
		);
	});

	test("text being typed has text's Cancel and Done", () => {
		assert.deepEqual(
			modeChrome({
				...nothing,
				editingText: true,
				styledText: true,
				layerName: "Text",
			}),
			{
				panel: "text",
				actions: { title: "Text", cancel: "text", done: "text" },
				inBar: false,
			},
		);
	});

	test("new text being typed, with nothing selected, has them too", () => {
		assert.deepEqual(
			modeChrome({ ...nothing, editingText: true, styledText: true }).actions,
			{ title: "Text", cancel: "text", done: "text" },
		);
	});

	test("selected text not being typed has no Cancel, and Done deselects", () => {
		// "Text" is what `layerKindName` gives a text layer, which a phone's
		// footer showed for it.
		assert.deepEqual(
			modeChrome({ ...nothing, styledText: true, layerName: "Text" }),
			{
				panel: "text",
				actions: { title: "Text", done: "deselect" },
				inBar: false,
			},
		);
	});

	test("another selected layer takes its name, with no Cancel", () => {
		assert.deepEqual(modeChrome({ ...nothing, layerName: "Sticker" }), {
			panel: "layer",
			actions: { title: "Sticker", done: "deselect" },
			inBar: false,
		});
	});

	test("nothing selected has no actions", () => {
		assert.deepEqual(modeChrome(nothing), {
			panel: "idle",
			actions: null,
			inBar: false,
		});
		assert.equal(modeChrome({ ...nothing, wide: true }).inBar, false);
	});

	test("a wide window puts every panel but idle in the bar, and a phone none", () => {
		const modes: [DockPanel, Partial<ModeChromeInput>][] = [
			...TOOLS.map(([tool]): [DockPanel, Partial<ModeChromeInput>] => [
				tool,
				{ tool },
			]),
			["text", { editingText: true, styledText: true }],
			["text", { styledText: true, layerName: "Text" }],
			["layer", { layerName: "Photo" }],
			["idle", {}],
		];
		for (const [panel, input] of modes) {
			const wide = modeChrome({ ...nothing, ...input, wide: true });
			const phone = modeChrome({ ...nothing, ...input, wide: false });
			assert.equal(wide.panel, panel);
			assert.equal(wide.inBar, panel !== "idle", panel);
			assert.equal(phone.inBar, false, panel);
			// The layouts differ only in where the panel goes.
			assert.deepEqual({ ...wide, inBar: false }, phone, panel);
		}
	});
});

describe("railChosenTool", () => {
	const idle = {
		tool: null,
		editingText: false,
		cropping: false,
		stickersOpen: false,
	};

	test("with nothing active, no tool is chosen", () => {
		assert.equal(railChosenTool(idle), null);
	});

	test("each tool marks its own button", () => {
		for (const [tool] of TOOLS) {
			assert.equal(railChosenTool({ ...idle, tool }), tool);
		}
	});

	test("text being typed marks Text", () => {
		assert.equal(railChosenTool({ ...idle, editingText: true }), "text");
	});

	test("cropping marks Crop", () => {
		assert.equal(railChosenTool({ ...idle, cropping: true }), "crop");
	});

	test("stickers open marks Sticker", () => {
		assert.equal(railChosenTool({ ...idle, stickersOpen: true }), "sticker");
	});

	test("text being typed comes before crop, stickers, and tools", () => {
		assert.equal(
			railChosenTool({
				tool: "draw",
				editingText: true,
				cropping: true,
				stickersOpen: true,
			}),
			"text",
		);
	});

	test("crop comes before stickers and tools", () => {
		assert.equal(
			railChosenTool({
				tool: "draw",
				editingText: false,
				cropping: true,
				stickersOpen: true,
			}),
			"crop",
		);
	});

	test("stickers come before tools", () => {
		assert.equal(
			railChosenTool({
				tool: "draw",
				editingText: false,
				cropping: false,
				stickersOpen: true,
			}),
			"sticker",
		);
	});
});
