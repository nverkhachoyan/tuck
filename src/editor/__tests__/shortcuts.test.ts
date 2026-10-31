/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUILT_IN_SPECS, BUILT_IN_TOOLBAR } from "../builtInSpecs.ts";
import { toolbarEntries } from "../editorChrome.ts";
import {
	type KeyPress,
	shortcutFor as shortcutForTools,
	shortcutGroups,
	toolsByKey,
} from "../shortcuts.ts";
import type { ToolSpecs } from "../toolSpec.ts";

const entries = toolbarEntries(BUILT_IN_SPECS, BUILT_IN_TOOLBAR);
const tools = toolsByKey(entries);
const shortcutFor = (press: KeyPress) => shortcutForTools(press, tools);

const press = (key: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
	key,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	...modifiers,
});

describe("shortcutFor", () => {
	test("treats ⌘ and Ctrl alike for undo and redo", () => {
		assert.deepEqual(shortcutFor(press("z", { metaKey: true })), {
			type: "undo",
		});
		assert.deepEqual(shortcutFor(press("z", { ctrlKey: true })), {
			type: "undo",
		});
		assert.deepEqual(
			shortcutFor(press("Z", { metaKey: true, shiftKey: true })),
			{ type: "redo" },
		);
		assert.deepEqual(shortcutFor(press("y", { ctrlKey: true })), {
			type: "redo",
		});
	});

	test("exports with the modifier and E", () => {
		assert.deepEqual(shortcutFor(press("e", { metaKey: true })), {
			type: "export",
		});
		assert.deepEqual(shortcutFor(press("E", { ctrlKey: true })), {
			type: "export",
		});
	});

	test("duplicates and reorders with the modifier", () => {
		assert.deepEqual(shortcutFor(press("d", { metaKey: true })), {
			type: "duplicate",
		});
		assert.deepEqual(shortcutFor(press("]", { metaKey: true })), {
			type: "reorder",
			step: 1,
		});
		assert.deepEqual(shortcutFor(press("[", { ctrlKey: true })), {
			type: "reorder",
			step: -1,
		});
	});

	test("steps a brush with plain brackets, and leaves a shifted one", () => {
		assert.deepEqual(shortcutFor(press("[")), { type: "brushSize", step: -1 });
		assert.deepEqual(shortcutFor(press("]")), { type: "brushSize", step: 1 });
		assert.equal(shortcutFor(press("[", { shiftKey: true })), null);
	});

	test("zooms in, out, and to fit with the modifier", () => {
		const zoom = (to: string) => ({ type: "zoom", to });
		assert.deepEqual(shortcutFor(press("=", { metaKey: true })), zoom("in"));
		assert.deepEqual(
			shortcutFor(press("+", { ctrlKey: true, shiftKey: true })),
			zoom("in"),
		);
		assert.deepEqual(shortcutFor(press("-", { metaKey: true })), zoom("out"));
		assert.deepEqual(shortcutFor(press("0", { ctrlKey: true })), zoom("fit"));
		assert.equal(shortcutFor(press("0")), null);
	});

	test("picks up a tool, or shows the layers, with a plain letter", () => {
		assert.deepEqual(shortcutFor(press("t")), { type: "tool", tool: "text" });
		assert.deepEqual(shortcutFor(press("d")), { type: "tool", tool: "pen" });
		assert.deepEqual(shortcutFor(press("s")), { type: "tool", tool: "shape" });
		assert.deepEqual(shortcutFor(press("x")), { type: "tool", tool: "eraser" });
		assert.deepEqual(shortcutFor(press("r")), {
			type: "tool",
			tool: "redact",
		});
		assert.deepEqual(shortcutFor(press("f")), { type: "tool", tool: "find" });
		assert.deepEqual(shortcutFor(press("a")), {
			type: "tool",
			tool: "sticker",
		});
		assert.deepEqual(shortcutFor(press("p")), { type: "tool", tool: "photo" });
		assert.deepEqual(shortcutFor(press("c")), { type: "tool", tool: "crop" });
		assert.deepEqual(shortcutFor(press("e")), { type: "tool", tool: "adjust" });
		assert.deepEqual(shortcutFor(press("g")), {
			type: "tool",
			tool: "removeBg",
		});
		assert.deepEqual(shortcutFor(press("l")), { type: "layers" });
		// Caps Lock on.
		assert.deepEqual(shortcutFor(press("T")), { type: "tool", tool: "text" });
	});

	test("leaves tool letters with Shift, Option, or ⌘ alone", () => {
		assert.equal(shortcutFor(press("T", { shiftKey: true })), null);
		assert.equal(shortcutFor(press("t", { altKey: true })), null);
		// ⌘C copies rather than cropping.
		assert.equal(shortcutFor(press("c", { metaKey: true })), null);
	});

	test("shows the shortcuts with ?, Shift or not", () => {
		assert.deepEqual(shortcutFor(press("?")), { type: "help" });
		assert.deepEqual(shortcutFor(press("?", { shiftKey: true })), {
			type: "help",
		});
	});

	test("deletes and deselects with plain keys", () => {
		assert.deepEqual(shortcutFor(press("Backspace")), { type: "delete" });
		assert.deepEqual(shortcutFor(press("Delete")), { type: "delete" });
		assert.deepEqual(shortcutFor(press("Escape")), { type: "deselect" });
	});

	test("edits the selection's text with Enter", () => {
		assert.deepEqual(shortcutFor(press("Enter")), { type: "edit" });
		assert.equal(shortcutFor(press("Enter", { shiftKey: true })), null);
		assert.equal(shortcutFor(press("Enter", { metaKey: true })), null);
	});

	test("nudges by one screen pixel, or ten with Shift", () => {
		assert.deepEqual(shortcutFor(press("ArrowLeft")), {
			type: "nudge",
			dx: -1,
			dy: 0,
		});
		assert.deepEqual(shortcutFor(press("ArrowDown", { shiftKey: true })), {
			type: "nudge",
			dx: 0,
			dy: 10,
		});
	});

	test("ignores other keys, unbound letters, and Option/Alt combinations", () => {
		assert.equal(shortcutFor(press("q")), null);
		assert.equal(shortcutFor(press("z")), null);
		assert.equal(shortcutFor(press("Tab")), null);
		assert.equal(shortcutFor(press("s", { metaKey: true })), null);
		assert.equal(shortcutFor(press("ArrowUp", { altKey: true })), null);
		assert.equal(
			shortcutFor(press("z", { metaKey: true, altKey: true })),
			null,
		);
	});
});

describe("shortcutGroups", () => {
	test("lists each tool's line in the toolbar's order, then the layers", () => {
		const [toolGroup] = shortcutGroups(entries, BUILT_IN_SPECS);
		assert.deepEqual(
			toolGroup.items.map((item) => item.keys),
			["T", "D", "S", "X", "R", "F", "A", "C", "E", "G", "B", "P", "L"],
		);
		assert.equal(toolGroup.items[5].action, "Find faces or text to redact");
	});

	test("gives a tool that takes the keys a group of its own", () => {
		const titles = (specs: ToolSpecs, toolbar: readonly string[]) =>
			shortcutGroups(toolbarEntries(specs, toolbar), specs).map(
				(group) => group.title,
			);
		assert.deepEqual(titles(BUILT_IN_SPECS, BUILT_IN_TOOLBAR), [
			"Tools",
			"Editing",
			"View",
			"Text",
			"Crop",
			"Help",
		]);
		const { crop: _, text: __, ...without } = BUILT_IN_SPECS;
		const toolbar = BUILT_IN_TOOLBAR.filter(
			(id) => id !== "crop" && id !== "text",
		);
		assert.deepEqual(titles(without, toolbar), [
			"Tools",
			"Editing",
			"View",
			"Help",
		]);
	});

	test("applies with ⌘/Ctrl+Enter while typing, and Enter otherwise", () => {
		const groups = shortcutGroups(
			toolbarEntries(BUILT_IN_SPECS, BUILT_IN_TOOLBAR),
			BUILT_IN_SPECS,
		);
		const keys = (title: string) =>
			groups
				.find((group) => group.title === title)
				?.items.map((item) => item.keys);
		assert.deepEqual(keys("Text"), ["mod+Enter", "Escape"]);
		assert.deepEqual(keys("Crop"), ["Enter", "Escape"]);
	});
});
