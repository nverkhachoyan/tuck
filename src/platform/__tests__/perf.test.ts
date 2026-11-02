/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { measurePerfSpan, startPerfSpan } from "../perf.ts";

describe("perf", () => {
	test("measures synchronous functions and creates measure entries", () => {
		const result = measurePerfSpan("tuck:test-sync", () => {
			return 42;
		});
		assert.equal(result, 42);

		const measures = performance.getEntriesByName("tuck:test-sync", "measure");
		assert.ok(measures.length > 0);
	});

	test("measures asynchronous functions and creates measure entries", async () => {
		const result = await measurePerfSpan("tuck:test-async", async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return "async-done";
		});
		assert.equal(result, "async-done");

		const measures = performance.getEntriesByName("tuck:test-async", "measure");
		assert.ok(measures.length > 0);
	});

	test("ends span even when sync function throws", () => {
		assert.throws(
			() =>
				measurePerfSpan("tuck:test-throw", () => {
					throw new Error("expected error");
				}),
			/expected error/,
		);

		const measures = performance.getEntriesByName("tuck:test-throw", "measure");
		assert.ok(measures.length > 0);
	});

	test("ends span even when async function rejects", async () => {
		await assert.rejects(
			measurePerfSpan("tuck:test-async-reject", async () => {
				throw new Error("expected async error");
			}),
			/expected async error/,
		);

		const measures = performance.getEntriesByName(
			"tuck:test-async-reject",
			"measure",
		);
		assert.ok(measures.length > 0);
	});

	test("startPerfSpan returns a noop or safe end function", () => {
		const end = startPerfSpan("tuck:manual-span");
		assert.doesNotThrow(() => end());
		// Calling end again is a no-op
		assert.doesNotThrow(() => end());
	});

	test("safely handles environments missing User Timing methods", () => {
		const originalMark = performance.mark;
		const originalMeasure = performance.measure;

		try {
			// Simulate Hermes lacking mark/measure
			// @ts-expect-error mutating performance for test
			performance.mark = undefined;
			// @ts-expect-error mutating performance for test
			performance.measure = undefined;

			assert.doesNotThrow(() => {
				const value = measurePerfSpan("tuck:missing-timing", () => 123);
				assert.equal(value, 123);
			});
		} finally {
			performance.mark = originalMark;
			performance.measure = originalMeasure;
		}
	});

	test("safely handles User Timing methods throwing", () => {
		const originalMark = performance.mark;

		try {
			performance.mark = () => {
				throw new Error("Hermes User Timing unsupported");
			};

			assert.doesNotThrow(() => {
				const value = measurePerfSpan("tuck:throwing-timing", () => 456);
				assert.equal(value, 456);
			});
		} finally {
			performance.mark = originalMark;
		}
	});
});
