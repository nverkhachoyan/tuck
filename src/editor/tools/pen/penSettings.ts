import { isHexColor } from "../../../ui/color.ts";
import type { Size } from "../../document/geometry.ts";
import {
	type DrawingLayer,
	hasEnds,
	hasOpacity,
	MIN_OPACITY,
	markStyle,
	type PenBrush,
	type PenEnds,
	type PenTip,
	penBrush,
	penEnds,
	strokeEnds,
	strokeOpacity,
	tipOpacity,
} from "../../layers/drawing/drawing.ts";
import type { MarkPatch } from "../../layers/drawing/drawingEdits.ts";

export type PenTipChoice = "pen" | PenTip;
export type EndsTip = "marker" | "ink";
export type OpacityTip = "pen" | "ink" | "neon";
export const smoothings = ["off", "light", "strong"] as const;
export type Smoothing = (typeof smoothings)[number];

/**
 * Pen preferences, per tip where tips differ:
 * - `sizes`: each tip's width, as a share of the canvas's shorter side.
 * - `opacity`: the ink's, for every tip but the highlighter.
 * - `ends`: the highlighter's and the marker's line ends.
 * - `smoothing`: how much a stroke evens out the finger's wobble.
 */
export type PenSettings = {
	tip: PenTipChoice;
	color: string;
	highlightColor: string;
	sizes: Record<PenTipChoice, number>;
	opacity: Record<OpacityTip, number>;
	ends: Record<EndsTip, PenEnds>;
	smoothing: Smoothing;
};

// Quick picks, as shares of the canvas's shorter side.
export const PEN_SIZES: Record<PenTipChoice, number[]> = {
	pen: [0.005, 0.01, 0.02, 0.035, 0.06],
	marker: [0.015, 0.025, 0.04, 0.06, 0.09],
	ink: [0.015, 0.025, 0.04, 0.06, 0.09],
	neon: [0.012, 0.022, 0.038, 0.06, 0.09],
};

// How far the size slider reaches, as shares: past the quick picks both ways.
export const PEN_SIZE_RANGE: Record<PenTipChoice, [number, number]> = {
	pen: [0.0015, 0.12],
	marker: [0.005, 0.18],
	ink: [0.005, 0.18],
	neon: [0.005, 0.18],
};

// How far behind the finger a smoothed stroke trails, in screen points.
export const SMOOTHING_PX: Record<Smoothing, number> = {
	off: 0,
	light: 4,
	strong: 12,
};

// How much `[` and `]` change the size: a sixth of it either way.
const SIZE_STEP = 1.15;

export const defaultPenSettings: PenSettings = {
	tip: "pen",
	color: "#FF3B30",
	highlightColor: "#FFD60A",
	sizes: {
		pen: PEN_SIZES.pen[1],
		marker: PEN_SIZES.marker[2],
		ink: PEN_SIZES.ink[2],
		neon: PEN_SIZES.neon[1],
	},
	opacity: { pen: 1, ink: tipOpacity("ink"), neon: 1 },
	ends: { marker: "rounded", ink: "rounded" },
	smoothing: "light",
};

const TIPS: PenTipChoice[] = ["pen", "marker", "ink", "neon"];

const shortSide = (size: Size) => Math.min(size.width, size.height);

// Finer than this doesn't show, and keeps saved preferences short.
const roundShare = (share: number) => Math.round(share * 1e5) / 1e5;
const roundOpacity = (opacity: number) => Math.round(opacity * 100) / 100;

/** `share` kept within `tip`'s slider range. */
export function clampSize(tip: PenTipChoice, share: number): number {
	const [min, max] = PEN_SIZE_RANGE[tip];
	return roundShare(Math.min(max, Math.max(min, share)));
}

export function clampOpacity(opacity: number): number {
	return roundOpacity(Math.min(1, Math.max(MIN_OPACITY, opacity)));
}

/** Where `opacity` sits along the opacity slider, 0–1 (from `MIN_OPACITY` to 1). */
export function opacityToSlider(opacity: number): number {
	return Math.min(1, Math.max(0, (opacity - MIN_OPACITY) / (1 - MIN_OPACITY)));
}

/** The opacity at `along` (0–1) on the opacity slider. */
export function sliderToOpacity(along: number): number {
	return clampOpacity(
		MIN_OPACITY + Math.min(1, Math.max(0, along)) * (1 - MIN_OPACITY),
	);
}

/**
 * Where `share` sits along `tip`'s size slider, 0–1. The slider is
 * logarithmic, so thin lines get as much of it as thick ones.
 */
export function sizeToSlider(tip: PenTipChoice, share: number): number {
	const [min, max] = PEN_SIZE_RANGE[tip];
	return Math.log(share / min) / Math.log(max / min);
}

/** The share at `along` (0–1) on `tip`'s size slider. */
export function sliderToSize(tip: PenTipChoice, along: number): number {
	const [min, max] = PEN_SIZE_RANGE[tip];
	return clampSize(tip, min * (max / min) ** Math.min(1, Math.max(0, along)));
}

/** The quick pick `share` is, within 1%, or -1 for a size of its own. */
export function presetIndex(tip: PenTipChoice, share: number): number {
	return PEN_SIZES[tip].findIndex(
		(preset) => Math.abs(preset - share) <= preset * 0.01,
	);
}

/**
 * Parses saved pen preferences with migration from legacy brush settings.
 * - Restores tip choice, colors, sizes, opacities, ends, and smoothing.
 * - A size saved as a quick pick's index (before sizes were free) becomes
 *   that pick's width.
 * - Falls back to defaultPenSettings for each value invalid or absent.
 */
export function parsePenSettings(saved: unknown): PenSettings {
	if (typeof saved !== "object" || saved === null) return defaultPenSettings;
	const {
		tip,
		tool,
		lastBrush,
		color,
		highlightColor,
		sizes,
		opacity,
		ends,
		smoothing,
	} = saved as Record<string, unknown>;
	const fields = (value: unknown) =>
		(typeof value === "object" && value !== null ? value : {}) as Record<
			string,
			unknown
		>;
	const savedSizes = fields(sizes);
	const sizeOf = (t: PenTipChoice) => {
		const size = savedSizes[t];
		if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
			return defaultPenSettings.sizes[t];
		}
		if (Number.isInteger(size)) {
			return size < PEN_SIZES[t].length
				? PEN_SIZES[t][size]
				: defaultPenSettings.sizes[t];
		}
		return clampSize(t, size);
	};
	const savedOpacity = fields(opacity);
	const opacityOf = (t: OpacityTip) => {
		const value = savedOpacity[t];
		return typeof value === "number" && Number.isFinite(value)
			? clampOpacity(value)
			: defaultPenSettings.opacity[t];
	};
	const savedEnds = fields(ends);
	const endsOf = (t: EndsTip) =>
		penEnds.find((each) => each === savedEnds[t]) ?? defaultPenSettings.ends[t];
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
		opacity: {
			pen: opacityOf("pen"),
			ink: opacityOf("ink"),
			neon: opacityOf("neon"),
		},
		ends: { marker: endsOf("marker"), ink: endsOf("ink") },
		smoothing:
			smoothings.find((each) => each === smoothing) ??
			defaultPenSettings.smoothing,
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

/** The current tip's width, as a share, kept within its range. */
export function withPenSize(settings: PenSettings, share: number): PenSettings {
	return {
		...settings,
		sizes: {
			...settings.sizes,
			[settings.tip]: clampSize(settings.tip, share),
		},
	};
}

export function stepPenSize(settings: PenSettings, step: 1 | -1): PenSettings {
	const current = settings.sizes[settings.tip];
	const next = clampSize(
		settings.tip,
		step === 1 ? current * SIZE_STEP : current / SIZE_STEP,
	);
	if (next === current) return settings;
	return withPenSize(settings, next);
}

/** The current tip's opacity, or null for the highlighter, which has none. */
export function penOpacity(settings: PenSettings): number | null {
	const { tip } = settings;
	return tip === "marker" ? null : settings.opacity[tip];
}

export function withPenOpacity(
	settings: PenSettings,
	opacity: number,
): PenSettings {
	const { tip } = settings;
	if (tip === "marker") return settings;
	const next = clampOpacity(opacity);
	if (next === settings.opacity[tip]) return settings;
	return {
		...settings,
		opacity: { ...settings.opacity, [tip]: next },
	};
}

/** The current tip's ends, or null for a tip that always ends round. */
export function penEndsOf(settings: PenSettings): PenEnds | null {
	const { tip } = settings;
	return tip === "marker" || tip === "ink" ? settings.ends[tip] : null;
}

export function withPenEnds(settings: PenSettings, ends: PenEnds): PenSettings {
	const { tip } = settings;
	if (tip !== "marker" && tip !== "ink") return settings;
	return { ...settings, ends: { ...settings.ends, [tip]: ends } };
}

export function penBrushFor(settings: PenSettings, size: Size): PenBrush {
	const { tip } = settings;
	return penBrush({
		color: penColor(settings),
		width: settings.sizes[tip] * shortSide(size),
		tip: tip === "pen" ? undefined : tip,
		ends: penEndsOf(settings) ?? undefined,
		opacity: penOpacity(settings) ?? undefined,
	});
}

/**
 * `settings` showing the mark `layer`'s style: its tip, its color (kept as
 * the highlight color for a highlight), its width, ends, and opacity.
 * The opacity is the mark's exactly, not rounded as a slider's, so strokes
 * drawn into the mark match it. The same settings for a drawing with no pen
 * strokes.
 */
export function withSelectedMark(
	settings: PenSettings,
	layer: DrawingLayer,
	size: Size,
): PenSettings {
	const style = markStyle(layer);
	if (!style) return settings;
	const tip: PenTipChoice = style.tip ?? "pen";
	const share = (style.width * layer.transform.scaleX) / shortSide(size);
	let next = withPenSize(
		withPenColor({ ...settings, tip }, style.color),
		share,
	);
	if (hasEnds(style.tip)) next = withPenEnds(next, strokeEnds(style));
	if (hasOpacity(style.tip) && tip !== "marker") {
		next = {
			...next,
			opacity: { ...next.opacity, [tip]: strokeOpacity(style) },
		};
	}
	return next;
}

/**
 * What changed from `before` to `after`, as a restyle of a mark: the tip,
 * the color, the width (in document units) when the size changed, and the
 * ends and opacity.
 */
export function markPatch(
	before: PenSettings,
	after: PenSettings,
	size: Size,
): MarkPatch {
	const patch: MarkPatch = {};
	if (after.tip !== before.tip) {
		patch.tip = after.tip === "pen" ? null : after.tip;
	}
	if (penColor(after) !== penColor(before)) patch.color = penColor(after);
	const from = penBrushFor(before, size);
	const to = penBrushFor(after, size);
	if (to.width !== from.width) patch.width = to.width;
	if (
		hasEnds(to.tip) &&
		(patch.tip !== undefined || strokeEnds(to) !== strokeEnds(from))
	) {
		patch.ends = strokeEnds(to);
	}
	if (strokeOpacity(to) !== strokeOpacity(from) || patch.tip !== undefined) {
		patch.opacity = to.opacity ?? null;
	}
	return patch;
}
