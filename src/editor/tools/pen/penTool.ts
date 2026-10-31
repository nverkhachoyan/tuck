import { defineTool } from "../../defineTool";
import { metaOf, PenBar, PenPanel, PenTray, TIPS } from "./PenPanel";
import type { PenTipChoice } from "./penSettings";
import { penSpec } from "./penSpec";
import { type PenController, usePenTool } from "./usePenTool";

export const penTool = defineTool<PenController>({
	spec: penSpec,
	useController: usePenTool,
	views: { Dock: PenPanel, Bar: PenBar, Tray: PenTray },
	canvasInput: (pen) => pen.canvasInput,
	finishStroke: (pen, stroke) => pen.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (pen, step) => pen.stepSize(step),
	variants: () =>
		TIPS.map((t) => ({ id: t.tip, label: t.title, icon: t.icon })),
	activeVariant: (pen) => pen.settings.tip,
	selectVariant: (pen, tipId) =>
		pen.change({ ...pen.settings, tip: tipId as PenTipChoice }),
	variantEntry: (pen) => {
		const meta = metaOf(pen.settings.tip);
		return { label: meta.title, icon: meta.icon };
	},
});
