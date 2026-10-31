/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defineTool, editorTools } from "../defineTool.ts";

const spec = {
	target: "none",
	tray: false,
	sized: false,
	label: "Ruler",
	icon: "ruler",
	key: "U",
	shortcut: "Measure",
	actsOn: () => false,
} as const;

const useController = () => null;
const views = { Dock: () => null, Stage: () => null };

const ruler = defineTool({ spec, useController, views: { Dock: views.Dock } });

describe("editorTools", () => {
	test("hands over the tools and the toolbar as they are", () => {
		const tools = { ruler };
		const config = editorTools({ tools, toolbar: ["ruler", "photo"] });
		assert.equal(config.tools, tools);
		assert.deepEqual(config.toolbar, ["ruler", "photo"]);
	});

	test("takes only tools in the list, and no id the editor uses", () => {
		// @ts-expect-error: the toolbar names a tool that isn't in the list.
		editorTools({ tools: { ruler }, toolbar: ["rular"] });
		// @ts-expect-error: "photo" is the editor's own entry.
		editorTools({ tools: { photo: ruler }, toolbar: [] });
	});
});

describe("defineTool", () => {
	test("gives a tool with a stage of its own no canvas input", () => {
		const staged = defineTool({ spec, useController, views });
		assert.equal(staged.views.Stage, views.Stage);
		// @ts-expect-error: the stage covers the canvas, so nothing reaches its input.
		defineTool({ spec, useController, views, canvasInput: () => null });
	});

	test("declares tool variants and active selection", () => {
		let chosen = "a";
		const grouped = defineTool({
			spec,
			useController: () => ({ current: chosen }),
			views: { Dock: views.Dock },
			variants: () => [
				{ id: "a", label: "Option A", icon: "pencil" },
				{ id: "b", label: "Option B", icon: "brush" },
			],
			activeVariant: (c) => c.current,
			selectVariant: (_c, id) => {
				chosen = id;
			},
			variantEntry: (c) => ({
				label: c.current === "b" ? "Option B" : "Option A",
				icon: c.current === "b" ? "brush" : "pencil",
			}),
		});

		const controller = grouped.useController({} as never);
		assert.deepEqual(grouped.variants?.(controller), [
			{ id: "a", label: "Option A", icon: "pencil" },
			{ id: "b", label: "Option B", icon: "brush" },
		]);
		assert.equal(grouped.activeVariant?.(controller), "a");
		assert.deepEqual(grouped.variantEntry?.(controller), {
			label: "Option A",
			icon: "pencil",
		});
		grouped.selectVariant?.(controller, "b");
		assert.equal(chosen, "b");
	});
});
