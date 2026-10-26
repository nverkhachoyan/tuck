import type { Size } from "../../../../model/geometry.ts";
import type { CutStroke } from "../../../../model/layers/image.ts";

// Picks the subject under a tap, or paints the cut by hand: keeping what
// it removed, or erasing what it kept.
export type CutOutTool = "pick" | "keep" | "erase";

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

/**
 * The brush `tool` is in use, one size dot up or down. It's the tool in use
 * rather than `settings.tool`, which may be a Pick the eraser stands in for
 * (see `cutOutTool`). Pick has no size.
 */
export function stepCutSize(
	settings: CutOutSettings,
	tool: CutOutTool,
	step: 1 | -1,
): CutOutSettings {
	if (tool === "pick") return settings;
	const key = tool === "keep" ? "keepSize" : "eraseSize";
	const next = Math.min(
		CUT_BRUSH_SIZES.length - 1,
		Math.max(0, settings[key] + step),
	);
	if (next === settings[key]) return settings;
	return { ...settings, [key]: next };
}

/**
 * The tool in use: Pick needs this device to find subjects, so without it,
 * the eraser takes its place.
 */
export function cutOutTool(
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
	if (tool === "pick") return null;
	const index = tool === "keep" ? settings.keepSize : settings.eraseSize;
	const width = CUT_BRUSH_SIZES[index] * Math.min(size.width, size.height);
	return {
		type: tool === "keep" ? "pen" : "eraser",
		width,
		...(settings.soft ? { feather: width * SOFT_FEATHER } : {}),
	};
}
