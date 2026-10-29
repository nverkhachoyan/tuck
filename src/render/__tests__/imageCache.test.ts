/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SkImage } from "react-native-skia";
import { createImageCache } from "../imageCache.ts";

function fakeDecoder() {
	const decodes: string[] = [];
	const disposed: string[] = [];
	const decode = async (uri: string) => {
		decodes.push(uri);
		return { dispose: () => disposed.push(uri) } as unknown as SkImage;
	};
	return { decode, decodes, disposed };
}

// Released images are freed on a timer, unless the cache is given another.
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createImageCache", () => {
	test("shares one decode between holders and frees it after the last release", async () => {
		const { decode, decodes, disposed } = fakeDecoder();
		const cache = createImageCache(decode);
		const first = cache.acquire("photo.jpg");
		const second = cache.acquire("photo.jpg");

		assert.equal(await first.decoded, await second.decoded);
		assert.deepEqual(decodes, ["photo.jpg"]);
		first.release();
		await nextTask();
		assert.deepEqual(disposed, []);
		second.release();
		await nextTask();
		assert.deepEqual(disposed, ["photo.jpg"]);
	});

	test("keeps an image taken straight back after its release", async () => {
		const { decode, decodes, disposed } = fakeDecoder();
		const cache = createImageCache(decode);
		const unmounted = cache.acquire("photo.jpg");
		await unmounted.decoded;

		unmounted.release();
		const remounted = cache.acquire("photo.jpg");
		await nextTask();

		assert.deepEqual(decodes, ["photo.jpg"]);
		assert.deepEqual(disposed, []);
		remounted.release();
		await nextTask();
		assert.deepEqual(disposed, ["photo.jpg"]);
	});

	test("frees a released image only when `later` says so", async () => {
		const { decode, disposed } = fakeDecoder();
		const pending: (() => void)[] = [];
		const cache = createImageCache(decode, (free) => pending.push(free));
		const held = cache.acquire("mask.png");
		await held.decoded;

		held.release();
		await nextTask();
		assert.deepEqual(disposed, [], "still drawn by an older recording");
		for (const free of pending.splice(0)) free();
		await nextTask();
		assert.deepEqual(disposed, ["mask.png"]);
	});

	test("decodes again after a failure, and the failed holder's release leaves the retry alone", async () => {
		const { decode, disposed } = fakeDecoder();
		let attempts = 0;
		const cache = createImageCache(async (uri) => {
			attempts++;
			if (attempts === 1) throw new Error("decode failed");
			return decode(uri);
		});
		const failed = cache.acquire("photo.jpg");
		await assert.rejects(failed.decoded);

		const retry = cache.acquire("photo.jpg");
		await retry.decoded;
		failed.release();
		await nextTask();

		assert.equal(attempts, 2);
		assert.deepEqual(disposed, []);
		retry.release();
		await nextTask();
		assert.deepEqual(disposed, ["photo.jpg"]);
	});
});
