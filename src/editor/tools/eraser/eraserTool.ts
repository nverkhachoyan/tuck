import { defineTool } from "../../defineTool";
import {
	ERASER_MODES,
	EraserBar,
	EraserPanel,
	eraserModeOf,
} from "./EraserPanel";
import type { EraserMode } from "./eraserSettings";
import { eraserSpec } from "./eraserSpec";
import { type EraserController, useEraserTool } from "./useEraserTool";

export const eraserTool = defineTool<EraserController>({
	spec: eraserSpec,
	useController: useEraserTool,
	views: { Dock: EraserPanel, Bar: EraserBar },
	canvasInput: (eraser) => eraser.canvasInput,
	finishStroke: (eraser, stroke) => eraser.finishStroke(stroke),
	deselectOnDone: true,
	startsUnselected: true,
	announcement: (eraser) => eraser.news,
	stepSize: (eraser, step) => eraser.stepSize(step),
	variants: () =>
		ERASER_MODES.map((m) => ({ id: m.mode, label: m.title, icon: m.icon })),
	activeVariant: (eraser) => eraser.settings.mode,
	selectVariant: (eraser, mode) => eraser.setMode(mode as EraserMode),
	// The tile keeps its short name, as "Stroke eraser" would wrap in the
	// rail, and shows the option chosen by its icon.
	variantEntry: (eraser) => ({
		label: eraserSpec.label,
		icon: eraserModeOf(eraser.settings.mode).icon,
	}),
});
