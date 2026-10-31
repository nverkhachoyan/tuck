/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUILT_IN_SPECS, BUILT_IN_TOOLBAR } from "../builtInSpecs.ts";
import {
	type DockPanel,
	layerActionsFor,
	type ModeChromeInput,
	modeChrome,
	toolbarEntries,
} from "../editorChrome.ts";
import { createDrawingLayer } from "../layers/drawing/drawing.ts";
import { createImageLayer } from "../layers/image/image.ts";
import { createRedactionBox } from "../layers/redaction/redaction.ts";
import { createShapeLayer } from "../layers/shape/shape.ts";
import { createTextLayer } from "../layers/text/text.ts";
import type { ToolSpec, ToolSpecs } from "../toolSpec.ts";

const specs: ToolSpecs = BUILT_IN_SPECS;

const nothing: ModeChromeInput = {
	specs,
	tool: null,
	stylingTool: null,
	layerName: null,
	toolDoneLabel: undefined,
	wide: false,
};

const TOOLS: [string, string][] = [
	["pen", "Pen"],
	["shape", "Shape"],
	["eraser", "Eraser"],
	["redact", "Redact"],
	["find", "Find"],
	["adjust", "Adjust"],
	["cut", "Cut"],
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
			tool: "pen",
			stylingTool: "text",
			layerName: "Text",
		});
		assert.equal(chrome.panel, "pen");
		assert.equal(chrome.actions?.title, "Pen");
	});

	test("a tool's Done says the label the tool gives", () => {
		assert.equal(
			modeChrome({ ...nothing, tool: "find", toolDoneLabel: "Redact 3 chosen" })
				.actions?.doneLabel,
			"Redact 3 chosen",
		);
	});

	test("only an open tool's Done takes its label", () => {
		assert.equal(
			modeChrome({ ...nothing, stylingTool: "text", toolDoneLabel: "Redact" })
				.actions?.doneLabel,
			undefined,
		);
	});

	test("a tool styling the selection shows its panel, with no Cancel, and Done deselects", () => {
		assert.deepEqual(
			modeChrome({ ...nothing, stylingTool: "text", layerName: "Text" }),
			{
				panel: "text",
				actions: { title: "Text", done: "deselect" },
				inBar: false,
			},
		);
		assert.deepEqual(
			modeChrome({ ...nothing, stylingTool: "shape", layerName: "Shape" }),
			{
				panel: "shape",
				actions: { title: "Shape", done: "deselect" },
				inBar: false,
			},
		);
		assert.deepEqual(
			modeChrome({ ...nothing, stylingTool: "redact", layerName: "Redaction" }),
			{
				panel: "redact",
				actions: { title: "Redact", done: "deselect" },
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
			["text", { tool: "text" }],
			["text", { stylingTool: "text", layerName: "Text" }],
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

describe("toolbarEntries", () => {
	test("gives each button its spec's or the editor's own label and key", () => {
		const entries = toolbarEntries(specs, BUILT_IN_TOOLBAR);
		assert.deepEqual(
			entries.map((entry) => [entry.id, entry.label, entry.key]),
			[
				["text", "Text", "T"],
				["pen", "Pen", "D"],
				["shape", "Shape", "S"],
				["eraser", "Eraser", "X"],
				["redact", "Redact", "R"],
				["find", "Find", "F"],
				["sticker", "Sticker", "A"],
				["crop", "Crop", "C"],
				["adjust", "Adjust", "E"],
				["removeBg", "Remove BG", "G"],
				["cut", "Cut", "B"],
				["photo", "Add photo", "P"],
			],
		);
	});

	test("a tool with a target waits for an image", () => {
		const waiting = toolbarEntries(specs, BUILT_IN_TOOLBAR)
			.filter((entry) => entry.needsImage)
			.map((entry) => entry.id);
		assert.deepEqual(waiting, ["find", "adjust", "removeBg", "cut"]);
	});

	test("takes a made-up tool's button from its spec", () => {
		const ruler: ToolSpec = {
			target: "photo",
			tray: false,
			sized: false,
			label: "Ruler",
			icon: "ruler",
			key: "U",
			shortcut: "Measure",
			actsOn: () => true,
		};
		assert.deepEqual(toolbarEntries({ ruler }, ["ruler", "photo"]), [
			{
				id: "ruler",
				label: "Ruler",
				icon: "ruler",
				key: "U",
				shortcut: "Measure",
				needsImage: true,
			},
			{
				id: "photo",
				label: "Add photo",
				icon: "image-plus-outline",
				key: "P",
				shortcut: "Add a photo",
				needsImage: false,
			},
		]);
	});
});

describe("layerActionsFor", () => {
	const canvas = { width: 100, height: 100 };
	const effect = { type: "solid", color: "#000000" } as const;
	const actions = (layer: Parameters<typeof layerActionsFor>[0]) =>
		layerActionsFor(layer, specs, BUILT_IN_TOOLBAR);

	test("a photo can be redacted, found, adjusted, and cut, in the toolbar's order", () => {
		const photo = createImageLayer(canvas, "photo.jpg", 100, 100, true);
		assert.deepEqual(actions(photo), [
			"redact",
			"find",
			"adjust",
			"removeBg",
			"cut",
		]);
		assert.deepEqual(actions({ ...photo, hidden: true }), ["adjust"]);
	});

	test("a sticker only offers adjust", () => {
		const sticker = createImageLayer(canvas, "sticker.png", 100, 100, false);
		sticker.sticker = true;
		assert.deepEqual(actions(sticker), ["adjust"]);
	});

	test("a drawing offers pen and eraser, while shape and redaction are styled directly", () => {
		const drawing = createDrawingLayer({
			type: "pen",
			color: "#FF3B30",
			width: 10,
			points: [0, 0, 10, 10],
		});
		assert.deepEqual(actions(drawing), ["pen", "eraser"]);
		const shape = createShapeLayer(
			"rectangle",
			{ x: 0, y: 0, rotation: 0, width: 40, height: 20 },
			{ color: "#FF3B30", strokeWidth: 4 },
		);
		assert.deepEqual(actions(shape), []);
		const redaction = createRedactionBox(
			{ x: 0, y: 0, width: 40, height: 20 },
			effect,
		);
		assert.deepEqual(actions(redaction), []);
	});

	test("text offers none of these", () => {
		assert.deepEqual(actions(createTextLayer(canvas, "Hello")), []);
	});

	test("a tool left out of the toolbar isn't offered", () => {
		const photo = createImageLayer(canvas, "photo.jpg", 100, 100, true);
		assert.deepEqual(layerActionsFor(photo, specs, ["adjust", "redact"]), [
			"adjust",
			"redact",
		]);
	});
});
