/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BLUR_STRENGTHS,
	defaultRedactLook,
	PIXEL_SIZES,
	parseRedactLook,
	redactionEffect,
	sameEffect,
	withEffect,
} from "../redactLook.ts";

const photo = { width: 4000, height: 3000 };

describe("redactionEffect", () => {
	test("covers with the chosen color by default", () => {
		assert.deepEqual(redactionEffect(defaultRedactLook, photo), {
			type: "solid",
			color: "#000000",
		});
	});

	test("blurs by the canvas's shorter side", () => {
		const look = { ...defaultRedactLook, effect: "blur" as const };
		assert.deepEqual(redactionEffect({ ...look, strength: 2 }, photo), {
			type: "blur",
			radius: BLUR_STRENGTHS[2] * 3000,
		});
	});

	test("pixelates by the canvas's shorter side", () => {
		const look = { ...defaultRedactLook, effect: "pixelate" as const };
		assert.deepEqual(redactionEffect({ ...look, strength: 0 }, photo), {
			type: "pixelate",
			size: PIXEL_SIZES[0] * 3000,
		});
	});
});

describe("withEffect", () => {
	test("shows a blur as its closest strength, keeping the rest", () => {
		const look = { ...defaultRedactLook, color: "#FFD60A", tool: "brush" };
		const shown = withEffect(
			look,
			{ type: "blur", radius: BLUR_STRENGTHS[2] * 3000 * 0.9 },
			photo,
		);
		assert.deepEqual(shown, { ...look, effect: "blur", strength: 2 });
	});

	test("shows pixels as their closest strength", () => {
		const shown = withEffect(
			defaultRedactLook,
			{ type: "pixelate", size: PIXEL_SIZES[1] * 3000 * 1.1 },
			photo,
		);
		assert.deepEqual(shown, {
			...defaultRedactLook,
			effect: "pixelate",
			strength: 1,
		});
	});

	test("comes back to the same effect", () => {
		for (const effect of [
			{ type: "solid", color: "#FFD60A" },
			{ type: "blur", radius: BLUR_STRENGTHS[0] * 3000 },
			{ type: "pixelate", size: PIXEL_SIZES[2] * 3000 },
		] as const) {
			const shown = withEffect(defaultRedactLook, effect, photo);
			assert.deepEqual(redactionEffect(shown, photo), effect);
		}
	});
});

describe("sameEffect", () => {
	test("ignores the other effect's settings", () => {
		const solid = defaultRedactLook;
		assert.ok(sameEffect(solid, { ...solid, strength: 0 }));
		assert.ok(!sameEffect(solid, { ...solid, color: "#FFFFFF" }));
		assert.ok(!sameEffect(solid, { ...solid, effect: "blur" }));
		const blur = { ...solid, effect: "blur" as const };
		assert.ok(sameEffect(blur, { ...blur, color: "#FFFFFF" }));
		assert.ok(!sameEffect(blur, { ...blur, strength: 2 }));
		assert.ok(!sameEffect(blur, { ...blur, effect: "pixelate" }));
	});
});

describe("parseRedactLook", () => {
	test("reads back a look saved as it is", () => {
		const look = { effect: "blur" as const, color: "#6B2FA0", strength: 2 };
		assert.deepEqual(parseRedactLook(JSON.parse(JSON.stringify(look))), look);
	});

	test("is the default when nothing, or nothing like a look, was saved", () => {
		for (const saved of [undefined, null, "blur", 3, []]) {
			assert.deepEqual(parseRedactLook(saved), defaultRedactLook);
		}
	});
});
