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
