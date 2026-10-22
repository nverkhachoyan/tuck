/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { faceTiles, mergeFaces } from "../faceTiles.ts";

describe("faceTiles", () => {
	test("starts with the whole image, then smaller square tiles", () => {
		const tiles = faceTiles(3000, 2000);
		assert.deepEqual(tiles[0], { x: 0, y: 0, width: 3000, height: 2000 });
		const sides = new Set(tiles.slice(1).map((tile) => tile.width));
		assert.deepEqual([...sides], [1500, 750]);
		for (const tile of tiles.slice(1)) {
			assert.equal(tile.width, tile.height);
		}
	});

	test("keeps every tile inside the image, in whole pixels", () => {
		for (const tile of faceTiles(3024, 4032)) {
			assert.ok(tile.x >= 0 && tile.y >= 0);
			assert.ok(tile.x + tile.width <= 3024);
			assert.ok(tile.y + tile.height <= 4032);
			for (const value of Object.values(tile)) {
				assert.ok(Number.isInteger(value));
			}
		}
	});

	test("covers the image at each size, with the tiles overlapping", () => {
		const tiles = faceTiles(3000, 2000).filter((tile) => tile.width === 750);
		const columns = [...new Set(tiles.map((tile) => tile.x))];
		const rows = [...new Set(tiles.map((tile) => tile.y))];
		assert.equal(columns[0], 0);
		assert.equal(rows[0], 0);
		assert.equal(columns.at(-1), 3000 - 750);
		assert.equal(rows.at(-1), 2000 - 750);
		for (let index = 1; index < columns.length; index++) {
			assert.ok(columns[index] - columns[index - 1] < 750);
		}
		assert.equal(tiles.length, columns.length * rows.length);
	});

	test("doesn't tile a small image", () => {
		assert.deepEqual(faceTiles(300, 200), [
			{ x: 0, y: 0, width: 300, height: 200 },
		]);
	});
});

describe("mergeFaces", () => {
	const image = { x: 0, y: 0, width: 1000, height: 1000 };
	const left = { x: 0, y: 0, width: 600, height: 1000 };
	const right = { x: 400, y: 0, width: 600, height: 1000 };

	test("leaves out a face cut by a tile's edge inside the image", () => {
		const cut = { x: 540, y: 100, width: 60, height: 60 };
		const whole = { x: 540, y: 100, width: 80, height: 60 };
		assert.deepEqual(mergeFaces([left, right], [[cut], [whole]], 1000, 1000), [
			whole,
		]);
	});

	test("keeps a face at the image's own edge", () => {
		const face = { x: 0, y: 0, width: 50, height: 50 };
		assert.deepEqual(mergeFaces([left], [[face]], 1000, 1000), [face]);
	});

	test("keeps the biggest of the boxes found for one face", () => {
		const small = { x: 100, y: 100, width: 50, height: 50 };
		const big = { x: 95, y: 95, width: 60, height: 60 };
		assert.deepEqual(mergeFaces([image, left], [[small], [big]], 1000, 1000), [
			big,
		]);
	});

	test("keeps faces that only touch", () => {
		const a = { x: 100, y: 100, width: 50, height: 50 };
		const b = { x: 140, y: 100, width: 50, height: 50 };
		assert.equal(mergeFaces([image], [[a, b]], 1000, 1000).length, 2);
	});

	test("trims a box to the image", () => {
		const face = { x: -10, y: 980, width: 50, height: 40 };
		assert.deepEqual(mergeFaces([image], [[face]], 1000, 1000), [
			{ x: 0, y: 980, width: 40, height: 20 },
		]);
	});
});
