/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ImageLayer } from "../../../../../model/layers/image.ts";
import { mapDetectionRects } from "../mapDetectionRects.ts";

const close = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be close to ${expected}`,
	);

function image(overrides: Partial<ImageLayer> = {}): ImageLayer {
	return {
		type: "image",
		id: "photo",
		uri: "file:///photo.jpg",
		width: 100,
		height: 80,
		flipped: false,
		opaque: true,
		transform: { x: 200, y: 100, scaleX: 2, scaleY: 3, rotation: 0 },
		hidden: false,
		locked: true,
		...overrides,
	};
}

describe("mapDetectionRects", () => {
	test("maps image pixels through move, nonuniform scale, and rotation", () => {
		const [mapped] = mapDetectionRects(
			image({
				transform: {
					x: 200,
					y: 100,
					scaleX: 2,
					scaleY: 3,
					rotation: Math.PI / 2,
				},
			}),
			[{ x: 20, y: 10, width: 20, height: 10 }],
			{ width: 500, height: 500 },
			"text",
		);
		close(mapped.transform.x, 275);
		close(mapped.transform.y, 60);
		close(mapped.width, 48);
		close(mapped.height, 42);
		close(mapped.transform.rotation, Math.PI / 2);
	});

	test("mirrors the region with a flipped image", () => {
		const [mapped] = mapDetectionRects(
			image({
				height: 100,
				flipped: true,
				transform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0 },
			}),
			[{ x: 10, y: 20, width: 20, height: 20 }],
			{ width: 100, height: 100 },
			"faces",
		);
		close(mapped.transform.x, 80);
		close(mapped.transform.y, 30);
		close(mapped.width, 25.6);
		close(mapped.height, 27.2);
	});

	test("follows an arbitrary straighten angle", () => {
		const rotation = 0.23;
		const [mapped] = mapDetectionRects(
			image({
				transform: { x: 200, y: 100, scaleX: 2, scaleY: 3, rotation },
			}),
			[{ x: 20, y: 10, width: 20, height: 10 }],
			{ width: 500, height: 500 },
			"text",
		);
		close(mapped.width, 48);
		close(mapped.height, 42);
		close(mapped.transform.rotation, rotation);
	});

	test("trims a partly cropped region and drops one outside the canvas", () => {
		const cropped = image({
			height: 100,
			transform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0 },
		});
		const [mapped] = mapDetectionRects(
			cropped,
			[{ x: 80, y: 40, width: 20, height: 20 }],
			{ width: 90, height: 100 },
			"text",
		);
		close(mapped.transform.x, 83.8);
		close(mapped.width, 12.4);
		close(mapped.height, 25.6);

		assert.deepEqual(
			mapDetectionRects(
				image({
					transform: {
						x: 250,
						y: 250,
						scaleX: 1,
						scaleY: 1,
						rotation: 0,
					},
				}),
				[{ x: 20, y: 20, width: 20, height: 20 }],
				{ width: 100, height: 100 },
				"faces",
			),
			[],
		);
	});

	test("maps rotated and flipped photo regions accurately", () => {
		const transformed = image({
			width: 100,
			height: 100,
			flipped: true,
			transform: {
				x: 200,
				y: 200,
				scaleX: 1,
				scaleY: 1,
				rotation: Math.PI / 2,
			},
		});
		const [mapped] = mapDetectionRects(
			transformed,
			[{ x: 20, y: 30, width: 40, height: 20 }],
			{ width: 500, height: 500 },
			"faces",
		);
		close(mapped.transform.rotation, Math.PI / 2);
		assert.ok(mapped.width > 0 && mapped.height > 0);
	});

	test("ignores zero or negative size regions", () => {
		assert.deepEqual(
			mapDetectionRects(
				image(),
				[
					{ x: 10, y: 10, width: 0, height: 20 },
					{ x: 10, y: 10, width: 20, height: -5 },
				],
				{ width: 500, height: 500 },
				"text",
			),
			[],
		);
	});
});
