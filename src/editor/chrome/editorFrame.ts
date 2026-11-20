import { fitDocumentToView, PHOTO_INSET } from "../canvas/viewport.ts";
import type { Size } from "../document/geometry.ts";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
export const SIDEBAR_MIN_WIDTH = 900;
// Wide enough for a tool rail at the left. Its options go in the header,
// and phones keep the dock.
export const WIDE_MIN_WIDTH = 1024;
// Tall enough to leave the layers inspector open beside the photo. A 13-inch
// laptop's browser is shorter than this, so that width stays with the photo
// until the panel is asked for. An iPad in landscape clears it.
export const INSPECTOR_PIN_MIN_HEIGHT = 960;

/**
 * Which of the editor's arrangements the window has room for.
 * - `layersBeside`: the layers can sit at the side instead of a bottom sheet.
 * - `wide`: a tool rail, with the open tool's options in the header.
 * - `inspectorPinned`: the layers inspector stays open. A shorter window
 *   leaves it closed until Layers, Find, or Adjust opens it.
 */
export function editorFrame(windowWidth: number, windowHeight: number) {
	const wide = windowWidth >= WIDE_MIN_WIDTH;
	return {
		layersBeside: windowWidth >= SIDEBAR_MIN_WIDTH,
		wide,
		inspectorPinned: wide && windowHeight >= INSPECTOR_PIN_MIN_HEIGHT,
	};
}

/**
 * Where a tool's card goes beside the fitted photo, or `null` to leave it
 * along the canvas's bottom. A tall photo on a wide window leaves the table
 * empty on both sides, and a card along the bottom would shrink it further,
 * so the card takes the right-hand side when it fits there whole.
 * - `stage`: the canvas's size, rail and inspector included.
 * - `inset`: what covers the stage's sides and bottom with no card open.
 * - Returns the card's left edge in the stage, a `gap` right of the photo.
 */
export function cardBeside({
	documentSize,
	stage,
	inset,
	cardWidth,
	gap,
}: {
	documentSize: Size;
	stage: Size;
	inset: { left: number; right: number; bottom: number };
	cardWidth: number;
	gap: number;
}): number | null {
	const area = {
		width: stage.width - inset.left - inset.right,
		height: stage.height - inset.bottom,
	};
	const fit = fitDocumentToView(documentSize, area, PHOTO_INSET);
	if (fit.scale <= 0) return null;
	const photoRight = inset.left + fit.offsetX + documentSize.width * fit.scale;
	const free = inset.left + area.width - photoRight;
	return free >= cardWidth + 2 * gap ? photoRight + gap : null;
}
