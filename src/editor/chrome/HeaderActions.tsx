import { StyleSheet, View } from "react-native";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { LAYERS_KEY } from "../shortcuts";

/**
 * The header's actions: layers toggle when the inspector isn't pinned,
 * undo and redo, keyboard shortcuts help, and Export.
 */
export function HeaderActions({
	layers,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onShortcuts,
	onExport,
}: {
	layers?: { open: boolean; onToggle: () => void };
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onShortcuts?: () => void;
	onExport?: () => void;
}) {
	return (
		<View style={styles.actions}>
			{layers && (
				<IconButton
					icon="layers-outline"
					label="Layers"
					shortcut={LAYERS_KEY}
					selected={layers.open}
					onPress={layers.onToggle}
				/>
			)}
			<IconButton
				icon="arrow-undo-outline"
				label="Undo"
				shortcut="mod+Z"
				disabled={!canUndo}
				onPress={onUndo}
			/>
			<IconButton
				icon="arrow-redo-outline"
				label="Redo"
				shortcut="mod+shift+Z"
				disabled={!canRedo}
				onPress={onRedo}
			/>
			{onShortcuts && (
				<IconButton
					icon="help-circle-outline"
					label="Keyboard shortcuts"
					shortcut="?"
					onPress={onShortcuts}
				/>
			)}
			{onExport && (
				<View style={styles.export}>
					<Button
						label="Export"
						icon="share-outline"
						variant="primary"
						size="small"
						shortcut="mod+E"
						onPress={onExport}
					/>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	export: {
		marginLeft: 6,
	},
});
