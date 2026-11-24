import { defineTool } from "../defineTool";
import { SelectBar, SelectPanel } from "./SelectPanel";
import { selectSpec } from "./selectSpec";
import { type SelectController, useSelectTool } from "./useSelectTool";

export const selectTool = defineTool<SelectController>({
	spec: selectSpec,
	useController: useSelectTool,
	views: { Dock: SelectPanel, Bar: SelectBar },
	canvasInput: (select) => select.canvasInput,
});
