/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	continueTravel,
	type PointerSample,
	startTravel,
} from "../pointerTravel.ts";

const travelThrough = (samples: PointerSample[]) => {
	let travel = startTravel(samples[0]);
	for (const sample of samples.slice(1)) {
		travel = continueTravel(travel, sample);
	}
	return { dx: travel.dx, dy: travel.dy };
};

describe("pointer travel", () => {
	test("adds up a single finger's movement", () => {
		assert.deepEqual(
			travelThrough([
				{ x: 10, y: 10, numberOfPointers: 1 },
				{ x: 15, y: 10, numberOfPointers: 1 },
				{ x: 30, y: 20, numberOfPointers: 1 },
			]),
			{ dx: 20, dy: 10 },
		);
	});

	test("ignores the midpoint's jump when a second finger lands", () => {
		assert.deepEqual(
			travelThrough([
				{ x: 10, y: 10, numberOfPointers: 1 },
				{ x: 20, y: 10, numberOfPointers: 1 },
				{ x: 70, y: 60, numberOfPointers: 2 },
				{ x: 75, y: 60, numberOfPointers: 2 },
			]),
			{ dx: 15, dy: 0 },
		);
	});

	test("ignores the midpoint's jump when a finger lifts", () => {
		assert.deepEqual(
			travelThrough([
				{ x: 70, y: 60, numberOfPointers: 2 },
				{ x: 80, y: 60, numberOfPointers: 2 },
				{ x: 30, y: 10, numberOfPointers: 1 },
				{ x: 30, y: 15, numberOfPointers: 1 },
			]),
			{ dx: 10, dy: 5 },
		);
	});
});
