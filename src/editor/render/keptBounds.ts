// How opaque a pixel must be to count as kept: a soft mask can leave a faint
// haze far from its subject, which trimming may cut through unseen.
const KEPT_ALPHA = 8;

/**
 * The smallest rectangle, in pixels, holding every pixel of an RGBA image
 * that's kept (more than faintly opaque), or null when none is.
 */
export function keptBounds(
	pixels: Uint8Array,
	width: number,
	height: number,
): { x: number; y: number; width: number; height: number } | null {
	let left = width;
	let right = -1;
	let top = height;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		const row = y * width * 4;
		for (let x = 0; x < width; x++) {
			if (pixels[row + x * 4 + 3] < KEPT_ALPHA) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			bottom = y;
		}
	}
	return right < 0
		? null
		: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
