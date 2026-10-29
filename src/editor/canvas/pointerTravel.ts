// Worklets, like `editor/document/geometry.ts`, so gestures run them on the UI thread.

/** A gesture event's position (on iOS, the midpoint of its pointers). */
export type PointerSample = {
	x: number;
	y: number;
	numberOfPointers: number;
};

/**
 * How far a gesture's pointers have moved since it began. The reported
 * position jumps when a finger lands or lifts, so a sample with a different
 * number of pointers only re-anchors instead of counting as movement.
 */
export type PointerTravel = {
	x: number;
	y: number;
	pointers: number;
	dx: number;
	dy: number;
};

export function startTravel(sample: PointerSample): PointerTravel {
	"worklet";
	return {
		x: sample.x,
		y: sample.y,
		pointers: sample.numberOfPointers,
		dx: 0,
		dy: 0,
	};
}

export function continueTravel(
	travel: PointerTravel,
	sample: PointerSample,
): PointerTravel {
	"worklet";
	const moved = sample.numberOfPointers === travel.pointers;
	return {
		x: sample.x,
		y: sample.y,
		pointers: sample.numberOfPointers,
		dx: moved ? travel.dx + sample.x - travel.x : travel.dx,
		dy: moved ? travel.dy + sample.y - travel.y : travel.dy,
	};
}
