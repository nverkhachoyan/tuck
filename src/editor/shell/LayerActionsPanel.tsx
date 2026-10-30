import { StyleSheet, View } from "react-native";
import { space } from "@/ui/theme";
import { BarButton } from "./ContextBar";
import { ToolButton, ToolRow } from "./ToolButton";
import type { ToolStarters } from "./ToolsPanel";
import type { ToolEntry, ToolIcon } from "./toolList";

/**
 * A button a tool adds to the selected layer's actions, like keeping a
 * photo as a sticker. `busy` spins while its work runs.
 */
export type LayerAction = {
	label: string;
	icon: ToolIcon;
	busy?: boolean;
	disabled?: boolean;
	onPress: () => void;
};

type LayerActionsProps = {
	tools: readonly ToolEntry[];
	busy: readonly string[];
	startTool: ToolStarters;
	actions: readonly LayerAction[];
};

/**
 * What only the selected photo, drawing, shape, or redaction can do, in
 * place of the tools, as the text panel is for text; the actions every
 * layer shares float by it (see `SelectionBar`). It's moved and sized on
 * the canvas, and tapping the canvas off it deselects it. `tools` are the
 * tools the layer offers (see `layerActionsFor`), spinning while in `busy`,
 * then the buttons tools add for it (`actions`).
 */
export function LayerActionsPanel({
	tools,
	busy,
	startTool,
	actions,
}: LayerActionsProps) {
	return (
		<ToolRow>
			{tools.map((entry) => (
				<ToolButton
					key={entry.id}
					label={entry.label}
					icon={entry.icon}
					busy={busy.includes(entry.id)}
					onPress={startTool[entry.id]}
				/>
			))}
			{actions.map((action) => (
				<ToolButton
					key={action.label}
					label={action.label}
					icon={action.icon}
					busy={action.busy}
					disabled={action.disabled}
					onPress={action.onPress}
				/>
			))}
		</ToolRow>
	);
}

/**
 * The same actions in the wide editor's header, each a 44-point button, with
 * the layer's kind as the bar's name and ✓ to deselect it. `SelectionBar`,
 * floating by the layer, is unchanged.
 */
export function LayerBar({
	tools,
	busy,
	startTool,
	actions,
}: LayerActionsProps) {
	return (
		<View style={styles.actions}>
			{tools.map((entry) => (
				<BarButton
					key={entry.id}
					label={entry.label}
					icon={entry.icon}
					shortcut={entry.key}
					busy={busy.includes(entry.id)}
					onPress={startTool[entry.id]}
				/>
			))}
			{actions.map((action) => (
				<BarButton
					key={action.label}
					label={action.label}
					icon={action.icon}
					busy={action.busy}
					disabled={action.disabled}
					onPress={action.onPress}
				/>
			))}
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
