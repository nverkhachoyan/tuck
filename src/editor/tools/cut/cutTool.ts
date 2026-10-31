import { defineTool } from "../../defineTool";
import { CutBar, CutOptions, CutPanel, TapModifierPill } from "./CutPanel";
import { cutSpec } from "./cutSpec";
import { type CutController, useCutTool } from "./useCutTool";

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
	variants: () => [
		{ id: "cut", label: "Cutout", icon: "scissors-cutting", shortcut: "B" },
		{ id: "removeBg", label: "Remove BG", icon: "auto-fix", shortcut: "G" },
	],
	activeVariant: () => "cut",
});
