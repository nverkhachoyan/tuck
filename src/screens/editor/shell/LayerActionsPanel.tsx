import { StyleSheet, View } from "react-native";
import type { Layer } from "@/model/layers/layer";
import { space } from "@/ui/theme";
import { TOOL_KEYS } from "../shortcuts";
import { BarButton } from "./ContextBar";
import { layerActionsFor } from "./layerActions";
import { ToolButton, ToolRow } from "./ToolButton";
import { TOOLS, type ToolStarters } from "./ToolsPanel";

/**
 * What only the selected photo, drawing, shape, or redaction can do, in
 * place of the tools, as the text panel is for text; the actions every
 * layer shares float by it (see `SelectionBar`). It's moved and sized on
 * the canvas, and tapping the canvas off it deselects it. Which tools a
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
	return (
		<ToolRow>
			{layerActionsFor(layer).map((key) => {
				const entry = TOOLS.find((tool) => tool.key === key);
				return (
					entry && (
						<ToolButton
							key={key}
							label={entry.label}
							icon={entry.icon}
							onPress={startTool[key]}
						/>
					)
				);
			})}
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

/**
 * The same actions in the wide editor's header, each a 44-point button, with
 * the layer's kind as the bar's name and ✓ to deselect it. `SelectionBar`,
 * floating by the layer, is unchanged.
 */
export function LayerBar({
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
	return (
		<View style={styles.actions}>
			{layerActionsFor(layer).map((key) => {
				const entry = TOOLS.find((tool) => tool.key === key);
				return (
					entry && (
						<BarButton
							key={key}
							label={entry.label}
							icon={entry.icon}
							shortcut={TOOL_KEYS[key]}
							onPress={startTool[key]}
						/>
					)
				);
			})}
			{onSaveSticker && (
				<BarButton
					label={sticker === "saved" ? "Saved" : "Sticker"}
					icon={
						sticker === "saved"
							? "sticker-check-outline"
							: "sticker-plus-outline"
					}
					busy={sticker === "saving"}
					disabled={sticker === "saved"}
					shortcut={TOOL_KEYS.sticker}
					onPress={onSaveSticker}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	// The gap the scrolling row used to leave between every child. These
	// actions stay as they were; the tools' groups use their own spacing.
	actions: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 0,
		gap: space.xs,
	},
});
