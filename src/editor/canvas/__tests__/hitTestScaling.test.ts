/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Transform } from "../../document/geometry.ts";
import { hitTestDrawing } from "../../layers/strokes.ts";
import { findLayerAt, type LayerTarget } from "../hitTest.ts";

const at = (x: number, y: number): Transform => ({
	x,
	y,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
});

function target(id: string, x: number, y: number): LayerTarget {
	const box = { halfWidth: 20, halfHeight: 20 };
	return {
		id,
		transform: at(x, y),
		box,
		hitBox: box,
		hitPadding: 0,
		strokes: null,
		clipped: false,
		resizeMode: "none",
		anchored: false,
	};
}

describe("hit-test scaling", () => {
	test("findLayerAt scales linearly over 100+ layers without complexity blow-up", () => {
		const LAYER_COUNT = 150;
		const targets: LayerTarget[] = [];
		for (let i = 0; i < LAYER_COUNT; i++) {
			targets.push(target(`layer-${i}`, i * 5, i * 5));
		}

		// Correctness on 100+ layers
		const top = findLayerAt(targets, {
			x: (LAYER_COUNT - 1) * 5,
			y: (LAYER_COUNT - 1) * 5,
		});
		assert.equal(top?.id, `layer-${LAYER_COUNT - 1}`);

		const bottom = findLayerAt(targets, { x: 0, y: 0 });
		assert.ok(bottom !== null);

		const outside = findLayerAt(targets, { x: -1000, y: -1000 });
		assert.equal(outside, null);

		// Performance ceiling check: 1,000 queries across 150 layers
		const start = performance.now();
		for (let q = 0; q < 1000; q++) {
			findLayerAt(targets, {
				x: (q % LAYER_COUNT) * 5,
				y: (q % LAYER_COUNT) * 5,
			});
		}
		const elapsed = performance.now() - start;

		// Wide ceiling: Should finish well under 250ms (typically ~1-3ms in V8).
		// Fails only on unexpected algorithmic complexity blow-up.
		assert.ok(
			elapsed < 250,
			`findLayerAt took ${elapsed.toFixed(2)}ms for 1,000 queries over ${LAYER_COUNT} layers (ceiling 250ms)`,
		);
	});

	test("stroke hit-testing scales over a long point list without complexity blow-up", () => {
		// Long stroke: 5,000 points (2,500 line segments)
		const POINT_COUNT = 5000;
		const points: number[] = new Array(POINT_COUNT * 2);
		for (let i = 0; i < POINT_COUNT; i++) {
			points[i * 2] = i * 2;
			points[i * 2 + 1] = Math.sin(i / 10) * 50;
		}

		const layer = {
			strokes: [
				{
					type: "pen" as const,
					color: "#000000",
					width: 10,
					points,
				},
			],
		};

		// Correctness
		// Hits on stroke vertex
		assert.equal(
			hitTestDrawing(layer, { x: 200, y: Math.sin(100 / 10) * 50 }, 0),
			true,
		);
		// Misses far away from the stroke
		assert.equal(hitTestDrawing(layer, { x: 200, y: 500 }, 0), false);

		// Performance ceiling check: 1,000 hit tests on 5,000-point stroke
		const start = performance.now();
		for (let q = 0; q < 1000; q++) {
			hitTestDrawing(layer, { x: (q * 10) % (POINT_COUNT * 2), y: 0 }, 5);
		}
		const elapsed = performance.now() - start;

		// Wide ceiling: Should finish well under 500ms (typically ~5-15ms in V8).
		// Fails only on unexpected algorithmic complexity blow-up.
		assert.ok(
			elapsed < 500,
			`hitTestDrawing took ${elapsed.toFixed(2)}ms for 1,000 queries on ${POINT_COUNT}-point stroke (ceiling 500ms)`,
		);
	});
});
