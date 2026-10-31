import { defineTool } from "../../defineTool";
import { textIndexAt } from "../../layers/text/textLayerLayout";
import { TextDraft, TextInput } from "./TextEditing";
import { TextDock, TextToolBar } from "./TextStylePanel";
import { textSpec } from "./textSpec";
import { type TextController, useTextTool } from "./useTextTool";

export const textTool = defineTool<TextController>({
	spec: textSpec,
	useController: useTextTool,
	views: {
		Dock: TextDock,
		Bar: TextToolBar,
		Input: TextInput,
		Draft: TextDraft,
	},
	stylesLayer: (layer) => layer.type === "text",
	prepare: (text) => text.startNew(),
	done: (text) => text.commit(),
	canvasInput: (text) => text.canvasInput,
	draft: (text) =>
		text.edit && text.shown
			? { layer: text.shown, isNew: text.edit.isNew }
			: null,
	edit: {
		owns: (layer) => layer.type === "text",
		start: (text, layer, point) => {
			if (layer.type !== "text") return;
			text.startEditing(layer, point ? textIndexAt(layer, point) : undefined);
		},
	},
});
