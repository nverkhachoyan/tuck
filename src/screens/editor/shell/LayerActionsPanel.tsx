import type { Layer } from "@/model/layers/layer";
import { layerActionsFor } from "./layerActions";
import { ToolButton, ToolRow } from "./ToolButton";
import { TOOLS, type ToolStarters } from "./ToolsPanel";

/**
 * What only the selected photo, drawing, shape, or redaction can do, in
 * place of the tools, as the text panel is for text; the actions every
 * layer shares float by it (see `SelectionBar`). It's moved and sized on
 * the canvas, and tapping the canvas off it deselects it. Which rows a
 * layer offers is `layerActionsFor`, and their labels and icons are `TOOLS`.
 * Keeping a photo as a sticker stays its own row: Saved, or Sticker.
 */
export function LayerActionsPanel({
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
	const actions = layerActionsFor({
		layer,
		startTool,
		sticker,
		onSaveSticker,
	});
	const button = (key: "draw" | "redact" | "adjust" | "find" | "cutOut") => {
		const onPress = {
			draw: actions.onDraw,
			redact: actions.onRedact,
			adjust: actions.onAdjust,
			find: actions.onFind,
			cutOut: actions.onCutOut,
		}[key];
		const entry = TOOLS.find((tool) => tool.key === key);
		return (
			onPress &&
			entry && (
				<ToolButton label={entry.label} icon={entry.icon} onPress={onPress} />
			)
		);
	};
	return (
		<ToolRow>
			{button("draw")}
			{button("redact")}
			{button("adjust")}
			{button("find")}
			{button("cutOut")}
			{onSaveSticker && (
				<ToolButton
					label={sticker === "saved" ? "Saved" : "Sticker"}
					icon={
						sticker === "saved"
							? "sticker-check-outline"
							: "sticker-plus-outline"
					}
					busy={sticker === "saving"}
					disabled={sticker === "saved"}
					onPress={onSaveSticker}
				/>
			)}
		</ToolRow>
	);
}
