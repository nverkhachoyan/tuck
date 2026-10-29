import type { LayerGroup } from "../../../model/document.ts";
import type { Layer } from "../../../model/layers/layer.ts";

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
