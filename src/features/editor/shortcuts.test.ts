/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type KeyPress, shortcutFor } from "./shortcuts.ts";

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

	test("picks up a tool, or shows the layers, with a plain letter", () => {
		assert.deepEqual(shortcutFor(press("t")), { type: "tool", tool: "text" });
		assert.deepEqual(shortcutFor(press("d")), { type: "tool", tool: "draw" });
		assert.deepEqual(shortcutFor(press("r")), {
			type: "tool",
			tool: "redact",
		});
		assert.deepEqual(shortcutFor(press("a")), { type: "tool", tool: "add" });
		assert.deepEqual(shortcutFor(press("p")), { type: "tool", tool: "photo" });
		assert.deepEqual(shortcutFor(press("c")), { type: "tool", tool: "crop" });
		assert.deepEqual(shortcutFor(press("e")), { type: "tool", tool: "adjust" });
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
