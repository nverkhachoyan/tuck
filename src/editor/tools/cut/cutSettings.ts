import type { CanvasTool } from "../../canvas/canvasTool.ts";
import type { Size } from "../../document/geometry.ts";
import type { CutStroke } from "../../layers/image/image.ts";

// Picks the subject under a tap, or paints the cut by hand: adding what
// it removed, or subtracting what it kept.
export type CutTool = "tap" | "add" | "subtract";
// The tools that paint, each with a size of its own.
export type CutBrushTool = Exclude<CutTool, "tap">;
// Whether a tap adds what's under it to the selection, or subtracts it.
export type CutTapMode = "add" | "subtract";

export type CutSettings = {
	tool: CutTool;
	// Indexes into `CUT_BRUSH_SIZES`; each brush keeps its own.
	addSize: number;
	subtractSize: number;
	// Whether both brushes' edges fade, like a found mask's.
	soft: boolean;
	tapMode: CutTapMode;
};

export const defaultCutSettings: CutSettings = {
	tool: "tap",
	addSize: 2,
	subtractSize: 2,
	soft: true,
	tapMode: "add",
};

// Brush widths as a share of the canvas's shorter side, like the other
// tools' sizes. Finer than Redact's: they follow an edge, not cover a line.
export const CUT_BRUSH_SIZES = [0.008, 0.016, 0.03, 0.05, 0.08];

// A soft brush's feather, as a share of its width: its edge fades over about
// half its width, and its middle stays solid.
const SOFT_FEATHER = 1 / 6;

const TOOLS: CutTool[] = ["tap", "add", "subtract"];

// What Cut out, before it became Cut, called its sub-tools and their sizes.
const LEGACY_TOOLS: Record<string, CutTool> = {
	pick: "tap",
	keep: "add",
	erase: "subtract",
};
const LEGACY_SIZES = {
	addSize: "keepSize",
	subtractSize: "eraseSize",
} as const;

/**
 * Cut settings from what an earlier session saved, which may be from an
 * older build (Cut out's names included), or damaged: each part that isn't
 * valid is the default's.
 */
export function parseCutSettings(saved: unknown): CutSettings {
	if (typeof saved !== "object" || saved === null) {
		return defaultCutSettings;
	}
	const fields = saved as Record<string, unknown>;
	const indexOf = (key: "addSize" | "subtractSize") => {
		const index = fields[key] ?? fields[LEGACY_SIZES[key]];
		return typeof index === "number" &&
			Number.isInteger(index) &&
			index >= 0 &&
			index < CUT_BRUSH_SIZES.length
			? index
			: defaultCutSettings[key];
	};
	return {
		tool:
			TOOLS.find((tool) => tool === fields.tool) ??
			(typeof fields.tool === "string"
				? LEGACY_TOOLS[fields.tool]
				: undefined) ??
			"tap",
		addSize: indexOf("addSize"),
		subtractSize: indexOf("subtractSize"),
		soft:
			typeof fields.soft === "boolean" ? fields.soft : defaultCutSettings.soft,
		tapMode: fields.tapMode === "subtract" ? "subtract" : "add",
	};
}

/** Whether `tool` paints the cut by hand, rather than picking a subject. */
export function isCutBrush(tool: CutTool): tool is CutBrushTool {
	return tool !== "tap";
}

// Where Add and Subtract each keep their size.
const SIZE_KEYS = { add: "addSize", subtract: "subtractSize" } as const;

/**
 * The size of `tool`, an index into `CUT_BRUSH_SIZES`. Null for Tap, which
 * has none. Each of these takes the tool in use rather than reading
 * `settings.tool`, which may be a Tap that Subtract stands in for (see
 * `cutToolInUse`).
 */
export function cutSizeIndex(settings: CutSettings, tool: CutBrushTool): number;
export function cutSizeIndex(
	settings: CutSettings,
	tool: CutTool,
): number | null;
export function cutSizeIndex(
	settings: CutSettings,
	tool: CutTool,
): number | null {
	return isCutBrush(tool) ? settings[SIZE_KEYS[tool]] : null;
}

/**
 * Settings with `tool` at size `index`; the other brush keeps its own. Tap
 * has no size, so its settings stay as they are.
 */
export function withCutSize(
	settings: CutSettings,
	tool: CutTool,
	index: number,
): CutSettings {
	return isCutBrush(tool)
		? { ...settings, [SIZE_KEYS[tool]]: index }
		: settings;
}

/** The brush `tool`, one size dot up or down. Tap has no size. */
export function stepCutSize(
	settings: CutSettings,
	tool: CutTool,
	step: 1 | -1,
): CutSettings {
	const index = cutSizeIndex(settings, tool);
	if (index === null) return settings;
	const next = Math.min(CUT_BRUSH_SIZES.length - 1, Math.max(0, index + step));
	if (next === index) return settings;
	return withCutSize(settings, tool, next);
}

/**
 * The tool in use: Tap needs this device to find subjects, so without it,
 * Subtract takes its place.
 */
export function cutToolInUse(settings: CutSettings, canPick: boolean): CutTool {
	return settings.tool === "tap" && !canPick ? "subtract" : settings.tool;
}

/**
 * The brush `tool` paints the cut with on a canvas of `size`: a pen keeps,
 * an eraser erases, feathered when soft. Null for Tap, which taps rather
 * than paints.
 */
export function cutBrush(
	settings: CutSettings,
	tool: CutTool,
	size: Size,
): Omit<CutStroke, "points"> | null {
	if (!isCutBrush(tool)) return null;
	const width =
		CUT_BRUSH_SIZES[cutSizeIndex(settings, tool)] *
		Math.min(size.width, size.height);
	return {
		type: tool === "add" ? "pen" : "eraser",
		width,
		...(settings.soft ? { feather: width * SOFT_FEATHER } : {}),
	};
}

/**
 * What dragging on a canvas of `size` does with Cut's `tool` in the
 * image `layerId`: paints the cut with its brush, or picks the subject with
 * a tap.
 */
export function cutCanvasTool(
	layerId: string,
	settings: CutSettings,
	tool: CutTool,
	size: Size,
): CanvasTool {
	const brush = cutBrush(settings, tool, size);
	return brush
		? { type: "cutBrush", layerId, brush }
		: { type: "pickSubject", layerId };
}
