// Distance from the anchor control and outer window margins.
export const POPOVER_GAP = 8;
export const POPOVER_MARGIN = 8;

export type PopoverRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type PopoverPlacement = "below" | "above" | "beside";

/**
 * Computes where a card hangs from `anchor`, clamped inside the viewport.
 * - `below`: hangs under the control, or flips above near the bottom.
 * - `above`: hangs over the control, centered horizontally, or flips below near the top.
 * - `beside`: right of the control, top-aligned, moving up near the bottom.
 */
export function placePopover(
	anchor: PopoverRect,
	card: { width: number; height: number },
	viewport: { width: number; height: number },
	placement: PopoverPlacement = "below",
): { left: number; top: number } {
	if (placement === "beside") {
		return {
			left: clamp(
				anchor.x + anchor.width + POPOVER_GAP,
				card.width,
				viewport.width,
			),
			top: clamp(anchor.y, card.height, viewport.height),
		};
	}
	if (placement === "above") {
		const above = anchor.y - POPOVER_GAP - card.height;
		const below = anchor.y + anchor.height + POPOVER_GAP;
		const fitsAbove = above >= POPOVER_MARGIN;
		const fitsBelow = below + card.height <= viewport.height - POPOVER_MARGIN;
		const rawTop = !fitsAbove && fitsBelow ? below : above;
		return {
			left: clamp(
				anchor.x + (anchor.width - card.width) / 2,
				card.width,
				viewport.width,
			),
			top: clamp(rawTop, card.height, viewport.height),
		};
	}
	const below = anchor.y + anchor.height + POPOVER_GAP;
	const fitsBelow = below + card.height <= viewport.height - POPOVER_MARGIN;
	const rawTop = fitsBelow ? below : anchor.y - POPOVER_GAP - card.height;
	return {
		left: clamp(anchor.x, card.width, viewport.width),
		top: clamp(rawTop, card.height, viewport.height),
	};
}

function clamp(start: number, size: number, viewport: number) {
	const max = Math.max(POPOVER_MARGIN, viewport - POPOVER_MARGIN - size);
	return Math.min(Math.max(POPOVER_MARGIN, start), max);
}
