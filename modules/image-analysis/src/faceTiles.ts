import type { Rect } from "./ImageAnalysis.types";

// Face detectors look at the image shrunk to a few hundred pixels, where the
// faces in a group photo are a few pixels wide and go unseen. So every
// platform looks at square tiles too, down to a quarter of the image's longer
// side: a face then needs to be about 1% of that side.
const TILE_SIDES = [1, 1 / 2, 1 / 4];
// Smaller tiles only blow up pixels the detector has already seen.
const MIN_TILE = 192;
// Tiles overlap by this much, so a face cut by one tile's edge is whole in the
// next as long as it's no wider than the overlap. A bigger face is found in
// bigger tiles.
const OVERLAP = 1 / 4;
// Two boxes are the same face when they share this much of the smaller one.
const SAME_FACE = 1 / 2;

/** The tiles to look for faces in, in whole pixels, the whole image first. */
export function faceTiles(width: number, height: number): Rect[] {
	const longSide = Math.max(width, height);
	const tiles: Rect[] = [];
	for (const fraction of TILE_SIDES) {
		const side = Math.round(longSide * fraction);
		if (fraction < 1 && side < MIN_TILE) break;
		const tileWidth = Math.min(side, width);
		const tileHeight = Math.min(side, height);
		for (const y of tileStarts(height, tileHeight)) {
			for (const x of tileStarts(width, tileWidth)) {
				tiles.push({ x, y, width: tileWidth, height: tileHeight });
			}
		}
	}
	return tiles;
}

function tileStarts(length: number, tile: number): number[] {
	if (tile >= length) return [0];
	const step = tile * (1 - OVERLAP);
	const count = Math.ceil((length - tile) / step) + 1;
	return Array.from({ length: count }, (_, index) =>
		Math.min(Math.round(index * step), length - tile),
	);
}

/**
 * One box for each face, from the boxes found in each of `tiles`. A box cut by
 * a tile's edge inside the image is left out: the face is whole in another
 * tile. Of the boxes for one face, the biggest is kept, so it covers the face.
 */
export function mergeFaces(
	tiles: Rect[],
	found: Rect[][],
	width: number,
	height: number,
): Rect[] {
	const image = { x: 0, y: 0, width, height };
	const whole = tiles.flatMap((tile, index) =>
		(found[index] ?? []).filter((face) => !isCut(face, tile, image)),
	);
	const kept: Rect[] = [];
	// Hermes has no `toSorted`.
	whole.sort((a, b) => area(b) - area(a));
	for (const face of whole) {
		const seen = kept.some(
			(other) => overlapArea(face, other) > SAME_FACE * area(face),
		);
		if (!seen) kept.push(face);
	}
	return kept.flatMap((face) => {
		const inside = intersection(face, image);
		return inside ? [inside] : [];
	});
}

function isCut(face: Rect, tile: Rect, image: Rect): boolean {
	const tileRight = tile.x + tile.width;
	const tileBottom = tile.y + tile.height;
	return (
		(tile.x > image.x && face.x <= tile.x) ||
		(tile.y > image.y && face.y <= tile.y) ||
		(tileRight < image.x + image.width && face.x + face.width >= tileRight) ||
		(tileBottom < image.y + image.height && face.y + face.height >= tileBottom)
	);
}

function area(rect: Rect): number {
	return rect.width * rect.height;
}

function overlapArea(a: Rect, b: Rect): number {
	const overlap = intersection(a, b);
	return overlap ? area(overlap) : 0;
}

function intersection(a: Rect, b: Rect): Rect | undefined {
	const x = Math.max(a.x, b.x);
	const y = Math.max(a.y, b.y);
	const width = Math.min(a.x + a.width, b.x + b.width) - x;
	const height = Math.min(a.y + a.height, b.y + b.height) - y;
	return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}
