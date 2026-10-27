// Where the context bar's fade ends: on the first option that doesn't fit
// whole, on either side, so the edge falls between options instead of across
// a label. Positions are in the scrolling row's coordinates.

/** An option's box, in its group's coordinates or its parent option's. */
export type ItemBox = { parent: string; x: number; width: number };

type Edges = { left: number; right: number };

// An option's left and right in the row: its ancestors' x added to its own.
export function rowEdges(
	groups: Record<string, number>,
	items: Record<string, ItemBox>,
): Edges[] {
	const origin = (parent: string, depth: number): number | null => {
		if (depth > 8) return null;
		const groupX = groups[parent];
		if (groupX != null) return groupX;
		const above = items[parent];
		if (!above) return null;
		const base = origin(above.parent, depth + 1);
		return base == null ? null : base + above.x;
	};
	const edges: Edges[] = [];
	for (const item of Object.values(items)) {
		const base = origin(item.parent, 0);
		if (base == null || item.width <= 0) continue;
		const left = base + item.x;
		edges.push({ left, right: left + item.width });
	}
	return edges;
}

// Drop a box that only exists to hold smaller options, such as the view
// around a whole segmented control. The fade stops on the options inside.
export function leafEdges(edges: Edges[]): Edges[] {
	return edges.filter((edge) => {
		const width = edge.right - edge.left;
		return !edges.some((other) => {
			if (other === edge) return false;
			return (
				other.left >= edge.left - 0.5 &&
				other.right <= edge.right + 0.5 &&
				other.right - other.left < width - 0.5
			);
		});
	});
}

// The left edge of the first option that doesn't fit in the row, or null
// when the visible row already ends between options.
export function fadeCut(edges: readonly Edges[], visibleRight: number) {
	let cut: number | null = null;
	for (const edge of edges) {
		if (edge.right <= visibleRight + 1) continue;
		if (cut == null || edge.left < cut) cut = edge.left;
	}
	if (cut == null || cut >= visibleRight) return null;
	return cut;
}

// The right edge of the last option that runs in from the left, so scrolling
// back doesn't slice a label either.
export function fadeCutLeft(edges: readonly Edges[], offset: number) {
	let cut: number | null = null;
	for (const edge of edges) {
		if (edge.left >= offset - 1) continue;
		if (cut == null || edge.right > cut) cut = edge.right;
	}
	if (cut == null || cut <= offset) return null;
	return cut;
}
