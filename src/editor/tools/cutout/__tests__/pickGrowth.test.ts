/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type LastPick, nextMask, picksAgain } from "../pickGrowth.ts";

describe("picksAgain", () => {
	const last: LastPick = {
		layerId: "photo",
		at: { x: 0.5, y: 0.5 },
		mask: "mask.png",
	};
	const layer = { id: "photo", mask: "mask.png" };

	test("picks again near the last pick, on the cut it left", () => {
		assert.equal(picksAgain(last, layer, { x: 0.51, y: 0.49 }), true);
	});

	test("starts over farther away, on another image, or a changed cut", () => {
		assert.equal(picksAgain(last, layer, { x: 0.6, y: 0.5 }), false);
		assert.equal(
			picksAgain(last, { ...layer, id: "other" }, { x: 0.5, y: 0.5 }),
			false,
		);
		assert.equal(
			picksAgain(last, { ...layer, mask: "undone.png" }, last.at),
			false,
		);
		assert.equal(picksAgain(last, { id: "photo" }, last.at), false);
		assert.equal(picksAgain(null, layer, last.at), false);
	});
});

describe("nextMask", () => {
	test("grows to the next mask, then back to the smallest", () => {
		assert.equal(nextMask(0, 3), 1);
		assert.equal(nextMask(1, 3), 2);
		assert.equal(nextMask(2, 3), 0);
		assert.equal(nextMask(0, 1), 0);
	});
});
