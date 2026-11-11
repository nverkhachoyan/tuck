import type { ToolVariant } from "../../shell/toolList";
import { defineTool } from "../defineTool";
import { CutBar, CutOptions, CutPanel, TapModifierPill } from "./CutPanel";
import type { CutVariant } from "./cutSettings";
import { cutSpec } from "./cutSpec";
import { removeBgSpec } from "./removeBgSpec";
import { type CutController, useCutTool } from "./useCutTool";

const CUT_VARIANTS: readonly ToolVariant[] = [
	{
		id: "cut",
		label: "Cutout",
		icon: cutSpec.icon,
		shortcut: cutSpec.key,
	},
	{
		id: "removeBg",
		label: removeBgSpec.label,
		icon: removeBgSpec.icon,
		shortcut: removeBgSpec.key,
		tool: "removeBg",
	},
];

export const cutTool = defineTool<CutController>({
	spec: cutSpec,
	useController: useCutTool,
	views: {
		Dock: CutPanel,
		Bar: CutBar,
		Tray: CutOptions,
		Results: TapModifierPill,
	},
	started: (cut, image) => cut.start(image),
	canvasInput: (cut) => cut.canvasInput,
	finishStroke: (cut, stroke) => cut.finishStroke(stroke),
	doneLabel: (cut) => cut.doneLabel,
	doneVariant: (cut) => (cut.canCommit ? cut.doneVariant : undefined),
	done: (cut) => cut.commit(),
	reset: (cut) => cut.reset,
	announcement: (cut) => cut.news,
	stepSize: (cut, step) => cut.stepSize(step),
	variants: () => CUT_VARIANTS,
	activeVariant: (cut) => (cut.open ? "cut" : cut.settings.variant),
	selectVariant: (cut, variantId) =>
		cut.setVariant(
			variantId === "removeBg" ? "removeBg" : ("cut" as CutVariant),
		),
});
