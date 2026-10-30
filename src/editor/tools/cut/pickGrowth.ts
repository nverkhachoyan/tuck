// How close a tap must be to the last pick's, as a share of the image's
// width and height, to pick there again: a finger rarely lands twice on the
// same pixel.
const SAME_SPOT = 0.02;

/** The last pick's place, and the mask it left the image with. */
export type LastPick = {
	layerId: string;
	at: { x: number; y: number };
	mask: string;
};

/**
 * Whether a tap `at` a point on the image `layer` (as fractions of its size)
 * picks again where the last pick did, to grow what it took to the next of
 * its masks: on the same image, near enough, with the cut it left
 * unchanged.
 */
export function picksAgain(
	last: LastPick | null,
	layer: { id: string; mask?: string },
	at: { x: number; y: number },
): boolean {
	return (
		last !== null &&
		last.layerId === layer.id &&
		last.mask === layer.mask &&
		Math.abs(last.at.x - at.x) <= SAME_SPOT &&
		Math.abs(last.at.y - at.y) <= SAME_SPOT
	);
}

/**
 * The mask to pick next of `count`, after `index`: the next larger, or the
 * smallest again after the largest.
 */
export function nextMask(index: number, count: number): number {
	return (index + 1) % count;
}
