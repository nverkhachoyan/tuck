// Relative `.ts` import keeps this loadable by Node's test runner.
import type { Size } from "../model/geometry.ts";

// The largest image export renders. A canvas expanded past a big photo can
// ask for more than a phone can hold while encoding it. Matches the photo
// picker's limit, so a photo exported at full size isn't resampled.
const MAX_PIXELS = 25_000_000;
const MAX_SIDE = 8192;

// Smaller sizes offered, by their longer side: common for sharing online.
const PRESETS = [2048, 1080];

export type ExportSize = Size & {
	// Of the document's own size.
	scale: number;
};

/**
 * The sizes a document can be exported at, largest first: the full size
 * (shrunk only past what export can hold), then each smaller preset.
 */
export function exportSizes(document: Size): ExportSize[] {
	const longSide = Math.max(document.width, document.height);
	const full = Math.min(
		1,
		Math.sqrt(MAX_PIXELS / (document.width * document.height)),
		MAX_SIDE / longSide,
	);
	const scales = [
		full,
		...PRESETS.map((side) => side / longSide).filter((scale) => scale < full),
	];
	return scales.map((scale) => ({
		scale,
		width: Math.max(1, Math.round(document.width * scale)),
		height: Math.max(1, Math.round(document.height * scale)),
	}));
}
