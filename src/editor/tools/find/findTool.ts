import { defineTool } from "../../defineTool";
import {
	FindBar,
	FindCard,
	FindOptions,
	FindPanel,
	FindTray,
} from "./FindPanel";
import { findDoneLabel } from "./findResults";
import { findSpec } from "./findSpec";
import { type FindController, useFindTool } from "./useFindTool";

// Done redacts the regions chosen, in the editor's redaction look.
export const findTool = defineTool<FindController>({
	spec: findSpec,
	useController: useFindTool,
	views: {
		Dock: FindPanel,
		Bar: FindBar,
		Tray: FindOptions,
		Results: FindTray,
		Card: FindCard,
	},
	canvasInput: (find) => find.canvasInput,
	doneLabel: (find) => findDoneLabel(find.selectedCount),
	doneVariant: (find) => (find.selectedCount > 0 ? "primary" : undefined),
	done: (find) => find.redact(),
	deselectOnDone: true,
});
