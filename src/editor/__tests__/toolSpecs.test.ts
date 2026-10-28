/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TOOL_SPECS } from "../toolSpecs.ts";

describe("TOOL_SPECS", () => {
	test("lists each spec by its own name", () => {
		for (const [name, spec] of Object.entries(TOOL_SPECS)) {
			assert.equal(spec.id, name);
		}
	});
});
