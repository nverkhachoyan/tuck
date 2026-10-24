// From the control, and from the window's edges.
export const POPOVER_GAP = 8;
export const POPOVER_MARGIN = 8;

export type PopoverRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * Where a card hangs from `anchor`: below it, or above it when that would
 * pass the window's bottom, then shifted in so it stays inside the window.
 * The card's left lines up with the control's, which is where a menu grows
 * from.
 */
export function placePopover(
	anchor: PopoverRect,
	card: { width: number; height: number },
	viewport: { width: number; height: number },
): { left: number; top: number } {
	const below = anchor.y + anchor.height + POPOVER_GAP;
	const fitsBelow = below + card.height <= viewport.height - POPOVER_MARGIN;
	const rawTop = fitsBelow ? below : anchor.y - POPOVER_GAP - card.height;
	return {
		left: clamp(anchor.x, card.width, viewport.width),
		top: clamp(rawTop, card.height, viewport.height),
	};
}

// `start` is where the card wants to be; it slides in when it would pass an edge.
function clamp(start: number, size: number, viewport: number) {
	const max = Math.max(POPOVER_MARGIN, viewport - POPOVER_MARGIN - size);
	return Math.min(Math.max(POPOVER_MARGIN, start), max);
}
