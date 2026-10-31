import { defineTool } from "../../defineTool";
import { RedactBar, RedactOptions, RedactPanel } from "./RedactPanel";
import { redactSpec } from "./redactSpec";
import { type RedactController, useRedactTool } from "./useRedactTool";

export const redactTool = defineTool<RedactController>({
	spec: redactSpec,
	useController: useRedactTool,
	views: { Dock: RedactPanel, Bar: RedactBar, Tray: RedactOptions },
	stylesLayer: (layer) => layer.type === "redaction",
	prepare: (redact) => redact.chooseTool(),
	canvasInput: (redact) => redact.canvasInput,
	finishStroke: (redact, stroke) => redact.finishStroke(stroke),
	deselectOnDone: true,
	stepSize: (redact, step) => redact.stepSize(step),
});
