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

	test("deletes and deselects with plain keys", () => {
		assert.deepEqual(shortcutFor(press("Backspace")), { type: "delete" });
		assert.deepEqual(shortcutFor(press("Delete")), { type: "delete" });
		assert.deepEqual(shortcutFor(press("Escape")), { type: "deselect" });
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

	test("ignores other keys, bare letters, and Option/Alt combinations", () => {
		assert.equal(shortcutFor(press("a")), null);
		assert.equal(shortcutFor(press("z")), null);
		assert.equal(shortcutFor(press("d")), null);
		assert.equal(shortcutFor(press("s", { metaKey: true })), null);
		assert.equal(shortcutFor(press("ArrowUp", { altKey: true })), null);
		assert.equal(
			shortcutFor(press("z", { metaKey: true, altKey: true })),
			null,
		);
	});
});
