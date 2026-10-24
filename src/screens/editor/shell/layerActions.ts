import type { Layer } from "../../../model/layers/layer.ts";
import type { ToolStarters } from "./ToolsPanel.ts";

/** What the dock offers for `layer`, by its kind. */
export function layerActionsFor({
	layer,
	startTool,
	sticker,
	onSaveSticker,
}: {
	layer: Layer;
	startTool: ToolStarters;
	sticker: "saving" | "saved" | undefined;
	onSaveSticker: (() => void) | undefined;
}) {
	const image = layer.type === "image";
	return {
		onDraw:
			layer.type === "drawing" || layer.type === "shape"
				? startTool.draw
				: undefined,
		onRedact:
			layer.type === "redaction" || image ? startTool.redact : undefined,
		onAdjust: image ? startTool.adjust : undefined,
		onFind: image && !layer.hidden ? startTool.find : undefined,
		onCutOut: image && !layer.hidden ? startTool.cutOut : undefined,
		sticker,
		onSaveSticker,
	};
}
