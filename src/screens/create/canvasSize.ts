// Relative `.ts` import keeps this loadable by Node's test runner.
import type { Size } from "../../model/geometry.ts";

export const MIN_CANVAS_SIDE = 16;
// Export's limit: a longer side would be shrunk on the way out.
export const MAX_CANVAS_SIDE = 8192;
// Matches the photo picker's limit: as large as the editor and export
// already hold.
const MAX_CANVAS_PIXELS = 25_000_000;

export const DEFAULT_CUSTOM_SIZE: Size = { width: 1200, height: 800 };

export type CanvasSizeCheck =
	| { size: Size; problem: null }
	// The problem is null while a field is empty: nothing to fix yet.
	| { size: null; problem: string | null };

/** The canvas size typed as `width` and `height`, or what's wrong with it. */
export function checkCanvasSize(
	width: string,
	height: string,
): CanvasSizeCheck {
	if (width === "" || height === "") return { size: null, problem: null };
	const size = { width: Number(width), height: Number(height) };
	if (!isSide(size.width) || !isSide(size.height)) {
		return {
			size: null,
			problem: `Each side must be ${MIN_CANVAS_SIDE} to ${MAX_CANVAS_SIDE.toLocaleString("en-US")} pixels.`,
		};
	}
	const pixels = size.width * size.height;
	if (pixels > MAX_CANVAS_PIXELS) {
		const megapixels = Math.ceil(pixels / 100_000) / 10;
		return {
			size: null,
			problem: `That's ${megapixels} megapixels. The most is ${MAX_CANVAS_PIXELS / 1_000_000}.`,
		};
	}
	return { size, problem: null };
}

/** A custom size saved by an earlier session, or the default. */
export function parseCustomSize(saved: unknown): Size {
	if (typeof saved !== "object" || saved === null) return DEFAULT_CUSTOM_SIZE;
	const { width, height } = saved as Partial<Size>;
	const check = checkCanvasSize(String(width), String(height));
	return check.size ?? DEFAULT_CUSTOM_SIZE;
}

function isSide(value: number) {
	return (
		Number.isInteger(value) &&
		value >= MIN_CANVAS_SIDE &&
		value <= MAX_CANVAS_SIDE
	);
}
