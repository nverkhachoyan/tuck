import type { Size } from "../../../../model/geometry.ts";
import type { CutStroke } from "../../../../model/layers/image.ts";
import type { CanvasTool } from "../../canvas/canvasTool.ts";

// Picks the subject under a tap, or paints the cut by hand: keeping what
// it removed, or erasing what it kept.
export type CutOutTool = "pick" | "keep" | "erase";
// The tools that paint, each with a size of its own.
export type CutBrushTool = Exclude<CutOutTool, "pick">;

export type CutOutSettings = {
	tool: CutOutTool;
	// Indexes into `CUT_BRUSH_SIZES`; each brush keeps its own.
	keepSize: number;
	eraseSize: number;
	// Whether both brushes' edges fade, like a found mask's.
	soft: boolean;
};

export const defaultCutOutSettings: CutOutSettings = {
	tool: "pick",
	keepSize: 2,
	eraseSize: 2,
	soft: true,
};

// Brush widths as a share of the canvas's shorter side, like the other
// tools' sizes. Finer than Redact's: they follow an edge, not cover a line.
export const CUT_BRUSH_SIZES = [0.008, 0.016, 0.03, 0.05, 0.08];

// A soft brush's feather, as a share of its width: its edge fades over about
// half its width, and its middle stays solid.
const SOFT_FEATHER = 1 / 6;

const TOOLS: CutOutTool[] = ["pick", "keep", "erase"];

/**
 * Cut out settings from what an earlier session saved, which may be from an
 * older build, or damaged: each part that isn't valid is the default's.
 */
export function parseCutOutSettings(saved: unknown): CutOutSettings {
	if (typeof saved !== "object" || saved === null) {
		return defaultCutOutSettings;
	}
	const fields = saved as Record<string, unknown>;
	const indexOf = (key: "keepSize" | "eraseSize") => {
		const index = fields[key];
		return typeof index === "number" &&
			Number.isInteger(index) &&
			index >= 0 &&
			index < CUT_BRUSH_SIZES.length
			? index
			: defaultCutOutSettings[key];
	};
	return {
		tool: TOOLS.find((tool) => tool === fields.tool) ?? "pick",
		keepSize: indexOf("keepSize"),
		eraseSize: indexOf("eraseSize"),
		soft:
			typeof fields.soft === "boolean"
				? fields.soft
				: defaultCutOutSettings.soft,
	};
}

/** Whether `tool` paints the cut by hand, rather than picking a subject. */
export function isCutBrush(tool: CutOutTool): tool is CutBrushTool {
	return tool !== "pick";
}

// Where Keep and Erase each keep their size.
const SIZE_KEYS = { keep: "keepSize", erase: "eraseSize" } as const;

/**
 * The size of `tool`, an index into `CUT_BRUSH_SIZES`. Null for Pick, which
 * has none. Each of these takes the tool in use rather than reading
 * `settings.tool`, which may be a Pick the eraser stands in for (see
 * `cutToolInUse`).
 */
export function cutSizeIndex(
	settings: CutOutSettings,
	tool: CutBrushTool,
): number;
export function cutSizeIndex(
	settings: CutOutSettings,
	tool: CutOutTool,
): number | null;
export function cutSizeIndex(
	settings: CutOutSettings,
	tool: CutOutTool,
): number | null {
	return isCutBrush(tool) ? settings[SIZE_KEYS[tool]] : null;
}

/**
 * Settings with `tool` at size `index`; the other brush keeps its own. Pick
 * has no size, so its settings stay as they are.
 */
export function withCutSize(
	settings: CutOutSettings,
	tool: CutOutTool,
	index: number,
): CutOutSettings {
	return isCutBrush(tool)
		? { ...settings, [SIZE_KEYS[tool]]: index }
		: settings;
}

/** The brush `tool`, one size dot up or down. Pick has no size. */
export function stepCutSize(
	settings: CutOutSettings,
	tool: CutOutTool,
	step: 1 | -1,
): CutOutSettings {
	const index = cutSizeIndex(settings, tool);
	if (index === null) return settings;
	const next = Math.min(CUT_BRUSH_SIZES.length - 1, Math.max(0, index + step));
	if (next === index) return settings;
	return withCutSize(settings, tool, next);
}

/**
 * The tool in use: Pick needs this device to find subjects, so without it,
 * the eraser takes its place.
 */
export function cutToolInUse(
	settings: CutOutSettings,
	canPick: boolean,
): CutOutTool {
	return settings.tool === "pick" && !canPick ? "erase" : settings.tool;
}

/**
 * The brush `tool` paints the cut with on a canvas of `size`: a pen keeps,
 * an eraser erases, feathered when soft. Null for Pick, which taps rather
 * than paints.
 */
export function cutBrush(
	settings: CutOutSettings,
	tool: CutOutTool,
	size: Size,
): Omit<CutStroke, "points"> | null {
	if (!isCutBrush(tool)) return null;
	const width =
		CUT_BRUSH_SIZES[cutSizeIndex(settings, tool)] *
		Math.min(size.width, size.height);
	return {
		type: tool === "keep" ? "pen" : "eraser",
		width,
		...(settings.soft ? { feather: width * SOFT_FEATHER } : {}),
	};
}

/**
 * What dragging on a canvas of `size` does with Cut out's `tool` in the
 * image `layerId`: paints the cut with its brush, or picks the subject with
 * a tap.
 */
export function cutCanvasTool(
	layerId: string,
	settings: CutOutSettings,
	tool: CutOutTool,
	size: Size,
): CanvasTool {
	const brush = cutBrush(settings, tool, size);
	return brush
		? { type: "cutBrush", layerId, brush }
		: { type: "pickSubject", layerId };
}
