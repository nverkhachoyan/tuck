import { defineTool } from "../../defineTool";
import { CropCanvas } from "./CropCanvas";
import { CropBar, CropControls, CropDock } from "./CropPanel";
import { cropSpec } from "./cropSpec";
import { type CropController, useCropTool } from "./useCropTool";

/**
 * Crops, turns, flips, and straightens the photo (the lowest locked one, see
 * `framingAnchor`), and sizes and fills the canvas around it.
 * - The box is the canvas-to-be: dragging it past the photo's edges expands
 *   the canvas. With no locked photo, the canvas itself is cropped and turned.
 * - Its own canvas takes the stage's place while it's open, with the chosen
 *   tab's controls under it.
 */
export const cropTool = defineTool<CropController>({
	spec: cropSpec,
	useController: useCropTool,
	views: {
		Dock: CropDock,
		Bar: CropBar,
		Stage: CropCanvas,
		Controls: CropControls,
	},
	done: (crop) => crop.done(),
	reset: (crop) => (crop.changed ? crop.reset : undefined),
});
