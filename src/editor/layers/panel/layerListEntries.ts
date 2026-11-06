import type { LayerGroup } from "../../document/document.ts";
import { swatchName } from "../../shell/swatches.ts";
import type { DrawingLayer, PenTip } from "../drawing/drawing.ts";
import type { Layer } from "../layer.ts";

// What the panel calls each pen tip's mark. Pen's own buttons name the tips
// ("Highlighter"), but the panel can't import a tool.
const MARK_KINDS: Record<PenTip | "pen", string> = {
	pen: "pen",
	marker: "highlight",
	ink: "marker",
	neon: "neon",
};

/**
 * A mark's name in the layers panel, from its kind and color: "Red pen",
 * "Yellow highlight", or just "Pen" for a color that isn't a swatch.
 * "Drawing" when its pen strokes differ in tip or color, as a drawing saved
 * before marks may, or it has none.
 */
export function markName(layer: DrawingLayer): string {
	let tip: PenTip | "pen" | null = null;
	let color: string | null = null;
	for (const stroke of layer.strokes) {
		if (stroke.type !== "pen") continue;
		const strokeTip = stroke.tip ?? "pen";
		const strokeColor = stroke.color.toUpperCase();
		if (tip === null) {
			tip = strokeTip;
			color = strokeColor;
		} else if (tip !== strokeTip || color !== strokeColor) {
			return "Drawing";
		}
	}
	if (tip === null || color === null) return "Drawing";
	const kind = MARK_KINDS[tip];
	const swatch = swatchName(color);
	return swatch
		? `${swatch} ${kind}`
		: `${kind[0].toUpperCase()}${kind.slice(1)}`;
}

export type LayerListEntry =
	| { type: "layer"; layer: Layer }
	| { type: "group"; group: LayerGroup; layers: Layer[] };

/**
 * The layers panel's rows, top first: each layer on its own, or the group
 * it's in, once, where the group's topmost layer is, holding its layers top
 * first. A group lists only the layers the document still has.
 */
export function layerListEntries(
	layers: readonly Layer[],
	groups: readonly LayerGroup[],
): LayerListEntry[] {
	const groupsByLayer = new Map<string, LayerGroup>();
	for (const group of groups) {
		for (const id of group.layerIds) groupsByLayer.set(id, group);
	}
	const topFirst = layers.slice().reverse();
	const shown = new Set<string>();
	const entries: LayerListEntry[] = [];
	for (const layer of topFirst) {
		const group = groupsByLayer.get(layer.id);
		if (!group) {
			entries.push({ type: "layer", layer });
		} else if (!shown.has(group.id)) {
			shown.add(group.id);
			entries.push({
				type: "group",
				group,
				layers: topFirst.filter((candidate) =>
					group.layerIds.includes(candidate.id),
				),
			});
		}
	}
	return entries;
}
