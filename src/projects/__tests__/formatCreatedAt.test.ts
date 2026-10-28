/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatCreatedAt } from "../formatCreatedAt.ts";

describe("formatCreatedAt", () => {
	test("is the locale's date and time, not a relative day", () => {
		const time = new Date(2026, 9, 24, 15, 15).getTime();
		assert.equal(
			formatCreatedAt(time),
			new Date(time).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			}),
		);
		assert.equal(formatCreatedAt(time).includes("Today"), false);
	});
});
