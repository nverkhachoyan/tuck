/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../model/layers/drawing.ts";
import { createImageLayer } from "../../model/layers/image.ts";
import { createRedactionBox } from "../../model/layers/redaction.ts";
import { createShapeLayer } from "../../model/layers/shape.ts";
import { createTextLayer } from "../../model/layers/text.ts";
import { BUILT_IN_SPECS, BUILT_IN_TOOLBAR } from "../builtInSpecs.ts";
import {
	type DockPanel,
	layerActionsFor,
	type ModeChromeInput,
	modeChrome,
	railChosenTool,
	toolbarEntries,
} from "../editorChrome.ts";
import type { ToolSpec, ToolSpecs } from "../toolSpec.ts";

const specs: ToolSpecs = BUILT_IN_SPECS;

const nothing: ModeChromeInput = {
	specs,
	tool: null,
	editingText: false,
	styledText: false,
	layerName: null,
	toolDoneLabel: undefined,
	wide: false,
};

const TOOLS: [string, string][] = [
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

	test("a tool's Done says the label the tool gives", () => {
		assert.equal(
			modeChrome({ ...nothing, tool: "find", toolDoneLabel: "Redact 3 chosen" })
				.actions?.doneLabel,
			"Redact 3 chosen",
		);
	});

	test("only a tool's Done takes its label", () => {
		assert.equal(
			modeChrome({ ...nothing, editingText: true, toolDoneLabel: "Redact" })
				.actions?.doneLabel,
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

describe("toolbarEntries", () => {
	test("gives each button its spec's or the editor's own label and key", () => {
		const entries = toolbarEntries(specs, BUILT_IN_TOOLBAR);
		assert.deepEqual(
			entries.map((entry) => [entry.id, entry.label, entry.key]),
			[
				["text", "Text", "T"],
				["draw", "Draw", "D"],
				["redact", "Redact", "R"],
				["find", "Find", "F"],
				["sticker", "Sticker", "A"],
				["crop", "Crop", "C"],
				["adjust", "Adjust", "E"],
				["cutOut", "Cut out", "B"],
				["photo", "Add photo", "P"],
			],
		);
	});

	test("a tool with a target waits for an image", () => {
		const waiting = toolbarEntries(specs, BUILT_IN_TOOLBAR)
			.filter((entry) => entry.needsImage)
			.map((entry) => entry.id);
		assert.deepEqual(waiting, ["find", "adjust", "cutOut"]);
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
		assert.deepEqual(toolbarEntries({ ruler }, ["ruler", "text"]), [
			{
				id: "ruler",
				label: "Ruler",
				icon: "ruler",
				key: "U",
				shortcut: "Measure",
				needsImage: true,
			},
			{
				id: "text",
				label: "Text",
				icon: "format-text",
				key: "T",
				shortcut: "Add text",
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

	test("a photo can be redacted, found, adjusted, and cut out, in the toolbar's order", () => {
		const photo = createImageLayer(canvas, "photo.jpg", 100, 100, true);
		assert.deepEqual(actions(photo), ["redact", "find", "adjust", "cutOut"]);
		assert.deepEqual(actions({ ...photo, hidden: true }), ["redact", "adjust"]);
	});

	test("a drawing or a shape is drawn, and a redaction is redacted", () => {
		const drawing = createDrawingLayer({
			type: "pen",
			color: "#FF3B30",
			width: 10,
			points: [0, 0, 10, 10],
		});
		assert.deepEqual(actions(drawing), ["draw"]);
		const shape = createShapeLayer(
			"rectangle",
			{ x: 0, y: 0, rotation: 0, width: 40, height: 20 },
			{ color: "#FF3B30", strokeWidth: 4 },
		);
		assert.deepEqual(actions(shape), ["draw"]);
		const redaction = createRedactionBox(
			{ x: 0, y: 0, width: 40, height: 20 },
			effect,
		);
		assert.deepEqual(actions(redaction), ["redact"]);
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
