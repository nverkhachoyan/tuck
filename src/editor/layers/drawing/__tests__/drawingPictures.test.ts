/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createPictureCache } from "../drawingPictures.ts";

type Pic = { id: number; dispose: () => void };

function harness() {
	const disposed: number[] = [];
	const pending: (() => void)[] = [];
	let next = 0;
	const cache = createPictureCache<Pic>((free) => {
		pending.push(free);
	});
	const make = (): Pic => {
		const id = next++;
		return { id, dispose: () => disposed.push(id) };
	};
	return {
		cache,
		disposed,
		make,
		flush() {
			const jobs = pending.splice(0);
			for (const job of jobs) job();
		},
	};
}

const strokes = (label: string) => [label];

describe("createPictureCache", () => {
	test("reuses one picture for a layer's strokes and multiply flag", () => {
		const { cache, make } = harness();
		const ink = strokes("a");
		const first = cache.pictureFor(
			"mark",
			{ strokes: ink, multiply: false },
			make,
		);
		const again = cache.pictureFor(
			"mark",
			{ strokes: ink, multiply: false },
			make,
		);
		const highlight = cache.pictureFor(
			"mark",
			{ strokes: ink, multiply: true },
			make,
		);

		assert.equal(again, first);
		assert.notEqual(highlight, first);
		assert.equal(highlight.id, 1);
	});

	test("a later recording does not dispose the picture a holder still draws", () => {
		const { cache, disposed, make, flush } = harness();
		const shown = cache.pictureFor(
			"mark",
			{ strokes: strokes("new"), multiply: false },
			make,
		);
		const release = cache.hold(shown);
		const end = cache.beginDraw();
		const older = cache.pictureFor(
			"mark",
			{ strokes: strokes("old"), multiply: false },
			make,
		);

		assert.notEqual(older, shown);
		end();
		flush();
		assert.deepEqual(disposed, [older.id]);
		release();
		flush();
		assert.deepEqual(disposed, [older.id, shown.id]);
	});

	test("an in-flight draw keeps the picture it recorded after a replacement", () => {
		const { cache, disposed, make, flush } = harness();
		const end = cache.beginDraw();
		const recorded = cache.pictureFor(
			"mark",
			{ strokes: strokes("old"), multiply: false },
			make,
		);
		const shown = cache.pictureFor(
			"mark",
			{ strokes: strokes("new"), multiply: false },
			make,
		);
		const release = cache.hold(shown);

		flush();
		assert.deepEqual(disposed, []);
		end();
		flush();
		assert.deepEqual(disposed, [recorded.id]);
		release();
		flush();
		assert.deepEqual(disposed, [recorded.id, shown.id]);
	});

	test("the last release frees the current picture, and a remount keeps it", () => {
		const { cache, disposed, make, flush } = harness();
		const ink = strokes("a");
		const key = { strokes: ink, multiply: false };
		const picture = cache.pictureFor("mark", key, make);
		const release = cache.hold(picture);

		release();
		const again = cache.hold(picture);
		flush();
		assert.deepEqual(disposed, []);
		assert.equal(cache.pictureFor("mark", key, make), picture);

		again();
		flush();
		assert.deepEqual(disposed, [picture.id]);
		const rerecorded = cache.pictureFor("mark", key, make);
		assert.notEqual(rerecorded, picture);
	});

	test("overlapping draws release a picture once, after the last one", () => {
		const { cache, disposed, make, flush } = harness();
		const key = { strokes: strokes("a"), multiply: false };
		const first = cache.beginDraw();
		const picture = cache.pictureFor("mark", key, make);
		const second = cache.beginDraw();
		assert.equal(cache.pictureFor("mark", key, make), picture);

		first();
		flush();
		assert.deepEqual(disposed, []);
		second();
		flush();
		assert.deepEqual(disposed, [picture.id]);
		flush();
		assert.deepEqual(disposed, [picture.id]);
	});
});
