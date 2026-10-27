import { defineTool } from "../../defineTool";
import { RedactBar, RedactOptions, RedactPanel } from "./RedactPanel";
import type { RedactController } from "./useRedactTool";

export const redactTool = defineTool<RedactController>({
	id: "redact",
	views: { Dock: RedactPanel, Bar: RedactBar, Tray: RedactOptions },
	deselectOnDone: true,
	stepSize: (redact, step) => redact.stepSize(step),
});
