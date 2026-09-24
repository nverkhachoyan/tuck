import { StyleSheet, View } from "react-native";
import { ToolButton } from "@/ui/ToolButton";

/**
 * Actions for the selected photo, in place of the tools, as the text panel
 * is for text: it's moved and sized on the canvas, and tapping the canvas
 * off it deselects it.
 */
export function PhotoPanel({
	canMoveForward,
	canMoveBackward,
	onMoveForward,
	onMoveBackward,
	onDuplicate,
	onDelete,
}: {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onMoveForward: () => void;
	onMoveBackward: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	return (
		<View style={styles.row}>
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
	// Like the toolbar it replaces.
	row: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 20,
		paddingHorizontal: 16,
	},
});
