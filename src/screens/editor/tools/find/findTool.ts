import { defineTool } from "../../defineTool";
import {
	FindBar,
	FindInspector,
	FindOptions,
	FindPanel,
	FindTray,
} from "./FindPanel";
import { findDoneLabel } from "./findResults";
import { findSpec } from "./findSpec";
import type { FindController } from "./useFindTool";

// Done redacts the regions chosen, in the editor's redaction look.
export const findTool = defineTool<FindController>({
	spec: findSpec,
	views: {
		Dock: FindPanel,
		Bar: FindBar,
		Tray: FindOptions,
		Results: FindTray,
		Inspector: FindInspector,
	},
	doneLabel: (find) => findDoneLabel(find.selectedCount),
	done: (find) => find.redact(),
	deselectOnDone: true,
});
