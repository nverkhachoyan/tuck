import { isHexColor } from "../../../ui/color.ts";
import type { Size } from "../../document/geometry.ts";
import type { Brush, PenTip } from "../../layers/drawing/drawing.ts";

export type PenTipChoice = "pen" | PenTip;

export type PenSettings = {
	tip: PenTipChoice;
	color: string;
	highlightColor: string;
	sizes: Record<PenTipChoice, number>;
};

export const defaultPenSettings: PenSettings = {
	tip: "pen",
	color: "#FF3B30",
	highlightColor: "#FFD60A",
	sizes: { pen: 1, marker: 2, ink: 2, neon: 1 },
};

export const PEN_SIZES: Record<PenTipChoice, number[]> = {
	pen: [0.005, 0.01, 0.02, 0.035, 0.06],
	marker: [0.015, 0.025, 0.04, 0.06, 0.09],
	ink: [0.015, 0.025, 0.04, 0.06, 0.09],
	neon: [0.012, 0.022, 0.038, 0.06, 0.09],
};

const TIPS: PenTipChoice[] = ["pen", "marker", "ink", "neon"];

const shortSide = (size: Size) => Math.min(size.width, size.height);

/**
 * Parses saved pen preferences with migration from legacy brush settings.
 * - Restores tip choice, color, highlight color, and size indexes.
 * - Falls back to defaultPenSettings when values are invalid or absent.
 */
export function parsePenSettings(saved: unknown): PenSettings {
	if (typeof saved !== "object" || saved === null) return defaultPenSettings;
	const { tip, tool, lastBrush, color, highlightColor, sizes } =
		saved as Record<string, unknown>;
	const savedSizes = (
		typeof sizes === "object" && sizes !== null ? sizes : {}
	) as Record<string, unknown>;
	const sizeOf = (t: PenTipChoice) => {
		const size = savedSizes[t];
		return typeof size === "number" &&
			Number.isInteger(size) &&
			size >= 0 &&
			size < PEN_SIZES[t].length
			? size
			: defaultPenSettings.sizes[t];
	};
	const chosenTip =
		TIPS.find((t) => t === tip) ??
		TIPS.find((t) => t === lastBrush) ??
		TIPS.find((t) => t === tool) ??
		"pen";
	return {
		tip: chosenTip,
		color: isHexColor(color) ? color : defaultPenSettings.color,
		highlightColor: isHexColor(highlightColor)
			? highlightColor
			: defaultPenSettings.highlightColor,
		sizes: {
			pen: sizeOf("pen"),
			marker: sizeOf("marker"),
			ink: sizeOf("ink"),
			neon: sizeOf("neon"),
		},
	};
}

export function penColor(settings: PenSettings): string {
	return settings.tip === "marker" ? settings.highlightColor : settings.color;
}

export function withPenColor(
	settings: PenSettings,
	color: string,
): PenSettings {
	return settings.tip === "marker"
		? { ...settings, highlightColor: color }
		: { ...settings, color };
}

export function withPenSize(settings: PenSettings, index: number): PenSettings {
	return {
		...settings,
		sizes: { ...settings.sizes, [settings.tip]: index },
	};
}

export function stepPenSize(settings: PenSettings, step: 1 | -1): PenSettings {
	const count = PEN_SIZES[settings.tip].length;
	const current = settings.sizes[settings.tip];
	const next = Math.min(count - 1, Math.max(0, current + step));
	if (next === current) return settings;
	return withPenSize(settings, next);
}

export function penBrushFor(settings: PenSettings, size: Size): Brush {
	const color = penColor(settings);
	const width =
		PEN_SIZES[settings.tip][settings.sizes[settings.tip]] * shortSide(size);
	return settings.tip === "pen"
		? { type: "pen", color, width }
		: { type: "pen", color, width, tip: settings.tip };
}
