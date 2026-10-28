import type { Size } from "../../model/geometry.ts";
import type { Layer } from "../../model/layers/layer.ts";

// Width / height, or "original" for the photo's own. Each fixed ratio's
// turned counterpart is listed too, so turning the photo keeps one selected.
export const ASPECTS = [
	{ id: "free", label: "Free", ratio: null },
	{ id: "original", label: "Original", ratio: "original" },
	{ id: "1:1", label: "Square", ratio: 1 },
	{ id: "4:5", label: "4:5", ratio: 4 / 5 },
	{ id: "5:4", label: "5:4", ratio: 5 / 4 },
	{ id: "3:4", label: "3:4", ratio: 3 / 4 },
	{ id: "4:3", label: "4:3", ratio: 4 / 3 },
	{ id: "9:16", label: "9:16", ratio: 9 / 16 },
	{ id: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
export type AspectId = (typeof ASPECTS)[number]["id"];

// The ratio menu's rows: free shapes, then portrait, then landscape.
export const ASPECT_ROWS: readonly (readonly AspectId[])[] = [
	["free", "original", "1:1"],
	["4:5", "3:4", "9:16"],
	["5:4", "4:3", "16:9"],
];

const TURNED: Partial<Record<AspectId, AspectId>> = {
	"4:5": "5:4",
	"5:4": "4:5",
	"3:4": "4:3",
	"4:3": "3:4",
	"9:16": "16:9",
	"16:9": "9:16",
};

/** The ratio a quarter turn makes of `id`, or undefined when it keeps it. */
export function turnedAspect(id: AspectId): AspectId | undefined {
	return TURNED[id];
}

/**
 * Width over height for `id`, null for Free. Original is read from `turned`,
 * the photo's size as it's turned.
 */
export function aspectRatio(id: AspectId, turned: Size): number | null {
	const choice = ASPECTS.find((option) => option.id === id);
	if (!choice || choice.ratio === null) return null;
	return choice.ratio === "original"
		? turned.width / turned.height
		: choice.ratio;
}

/**
 * What the choice to turn other layers with the photo is called, or null
 * when no visible layer but the photo could take it. Redactions always turn
 * with the photo (see `turnsWithPhoto`), so they have no say.
 */
export function turnLayersLabel(
	layers: readonly Layer[],
	anchorLayer: Layer | null,
): string | null {
	const choosable = layers.filter(
		(layer) => layer !== anchorLayer && layer.type !== "redaction",
	);
	if (!choosable.some((layer) => !layer.hidden)) return null;
	return choosable.every((layer) => layer.type === "text")
		? "Turn text"
		: "Turn layers";
}
