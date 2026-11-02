/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatBytes } from "../formatBytes.ts";

describe("formatBytes", () => {
	test("formats 0 bytes", () => {
		assert.equal(formatBytes(0), "0 B");
	});

	test("formats bytes under 1 KB", () => {
		assert.equal(formatBytes(512), "512 B");
		assert.equal(formatBytes(1023), "1023 B");
	});

	test("formats kilobytes", () => {
		assert.equal(formatBytes(1024), "1.0 KB");
		assert.equal(formatBytes(32_000), "31.3 KB");
	});

	test("formats megabytes", () => {
		assert.equal(formatBytes(1024 * 1024), "1.0 MB");
		// 97,880,832 bytes (24MP iPhone photo bitmap uncompressed)
		assert.equal(formatBytes(97_880_832), "93.3 MB");
	});
});
