// Worklets, like `model/geometry.ts`, so the layers panel's drag runs them
// on the UI thread. The panel lists the layers above the photo top first,
// one slot per row.

/** `items` with the one at `from` moved to `to`. */
export function moveItem<T>(
	items: readonly T[],
	from: number,
	to: number,
): T[] {
	"worklet";
	const next = items.slice();
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

/**
 * Where a row dragged `dy` from `startSlot` is drawn, kept within the list
 * of `count` rows, and the slot it would drop into from there.
 */
export function dragRow(
	startSlot: number,
	dy: number,
	rowHeight: number,
	count: number,
): { top: number; slot: number } {
	"worklet";
	const top = Math.min(
		Math.max(startSlot * rowHeight + dy, 0),
		(count - 1) * rowHeight,
	);
	return { top, slot: Math.round(top / rowHeight) };
}

/**
 * The index in `document.layers` of the row at `slot`: slot 0 is the top
 * layer, and the photo at index 0 has no slot.
 */
export function layerIndexForSlot(slot: number, count: number): number {
	"worklet";
	return count - slot;
}
