import type { Size } from "../../document/geometry.ts";
import type { Brush } from "../../layers/drawing/drawing.ts";

export type EraserSettings = {
	sizeIndex: number;
};

export const defaultEraserSettings: EraserSettings = {
	sizeIndex: 3,
};

export const ERASER_SIZES = [0.005, 0.01, 0.02, 0.035, 0.06];

const shortSide = (size: Size) => Math.min(size.width, size.height);

/**
 * Parses saved eraser preferences.
 * - Restores size index.
 * - Falls back to defaultEraserSettings when values are invalid or absent.
 */
export function parseEraserSettings(saved: unknown): EraserSettings {
	if (typeof saved !== "object" || saved === null) return defaultEraserSettings;
	const { sizeIndex, sizes } = saved as Record<string, unknown>;
	const savedSizes = (
		typeof sizes === "object" && sizes !== null ? sizes : {}
	) as Record<string, unknown>;
	const parsedSize =
		typeof sizeIndex === "number" &&
		Number.isInteger(sizeIndex) &&
		sizeIndex >= 0 &&
		sizeIndex < ERASER_SIZES.length
			? sizeIndex
			: typeof savedSizes.eraser === "number" &&
					Number.isInteger(savedSizes.eraser) &&
					savedSizes.eraser >= 0 &&
					savedSizes.eraser < ERASER_SIZES.length
				? savedSizes.eraser
				: defaultEraserSettings.sizeIndex;
	return { sizeIndex: parsedSize };
}

export function stepEraserSize(
	settings: EraserSettings,
	step: 1 | -1,
): EraserSettings {
	const next = Math.min(
		ERASER_SIZES.length - 1,
		Math.max(0, settings.sizeIndex + step),
	);
	if (next === settings.sizeIndex) return settings;
	return { sizeIndex: next };
}

export function eraserBrushFor(settings: EraserSettings, size: Size): Brush {
	return {
		type: "eraser",
		width: ERASER_SIZES[settings.sizeIndex] * shortSide(size),
	};
}
