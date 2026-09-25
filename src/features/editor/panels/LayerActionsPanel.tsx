import { StyleSheet, View } from "react-native";
import { ToolButton } from "./ToolButton";

/**
 * Actions for the selected photo or drawing, in place of the tools, as the
 * text panel is for text: it's moved and sized on the canvas, and tapping
 * the canvas off it deselects it. `onDraw` goes on drawing on it.
 */
export function LayerActionsPanel({
	canMoveForward,
	canMoveBackward,
	onDraw,
	onMoveForward,
	onMoveBackward,
	onDuplicate,
	onDelete,
}: {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onDraw?: () => void;
	onMoveForward: () => void;
	onMoveBackward: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	return (
		<View style={styles.row}>
			{onDraw && <ToolButton label="Draw" icon="draw" onPress={onDraw} />}
			<ToolButton
				label="Forward"
				icon="arrange-bring-forward"
				shortcut="mod+]"
				disabled={!canMoveForward}
				onPress={onMoveForward}
			/>
			<ToolButton
				label="Backward"
				icon="arrange-send-backward"
				shortcut="mod+["
				disabled={!canMoveBackward}
				onPress={onMoveBackward}
			/>
			<ToolButton
				label="Duplicate"
				icon="content-copy"
				shortcut="mod+D"
				onPress={onDuplicate}
			/>
			<ToolButton
				label="Delete"
				icon="trash-can-outline"
				shortcut="Delete"
				tone="danger"
				onPress={onDelete}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	// Like ToolsPanel, which it replaces. Five tiles still fit a phone's width.
	row: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
		paddingHorizontal: 12,
	},
});
