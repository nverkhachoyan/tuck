/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	isSavedSticker,
	newStickerId,
	parseStickerIndex,
	type SavedSticker,
	serializeStickerIndex,
	stickerFileName,
	withStickerUsed,
} from "./savedStickers.ts";

const sticker = (id: string, usedAt: number): SavedSticker => ({
	id,
	width: 512,
	height: 256,
	opaque: false,
	usedAt,
});

describe("saved stickers", () => {
	test("a new id is valid and differs each time", () => {
		const id = newStickerId(1_000);
		assert.ok(isSavedSticker({ ...sticker(id, 1), id }));
		assert.notEqual(newStickerId(1_000), id);
	});

	test("a sticker's file is a JPEG's if opaque, else a PNG's", () => {
		assert.equal(
			stickerFileName({ id: "sticker-a", opaque: true }),
			"sticker-a.jpg",
		);
		assert.equal(
			stickerFileName({ id: "sticker-a", opaque: false }),
			"sticker-a.png",
		);
	});

	test("reads back what was saved, most recently used first", () => {
		const older = sticker("sticker-old", 1);
		const newer = sticker("sticker-new", 2);
		assert.deepEqual(parseStickerIndex(serializeStickerIndex([older, newer])), [
			newer,
			older,
		]);
	});

	test("reads nothing from a missing, damaged, or newer index", () => {
		assert.deepEqual(parseStickerIndex(null), []);
		assert.deepEqual(parseStickerIndex("{"), []);
		assert.deepEqual(parseStickerIndex("[]"), []);
		assert.deepEqual(
			parseStickerIndex(JSON.stringify({ version: 2, stickers: [] })),
			[],
		);
		assert.deepEqual(parseStickerIndex(JSON.stringify({ version: 1 })), []);
	});

	test("drops malformed stickers but keeps the rest", () => {
		const good = sticker("sticker-good", 1);
		const json = JSON.stringify({
			version: 1,
			stickers: [
				good,
				{ ...good, id: "../escape" },
				{ ...good, width: 0 },
				{ ...good, opaque: "no" },
				{ ...good, usedAt: null },
				null,
			],
		});
		assert.deepEqual(parseStickerIndex(json), [good]);
	});

	test("using a sticker moves it first", () => {
		const a = sticker("sticker-a", 3);
		const b = sticker("sticker-b", 2);
		assert.deepEqual(
			withStickerUsed([a, b], "sticker-b", 4).map(({ id }) => id),
			["sticker-b", "sticker-a"],
		);
	});
});
