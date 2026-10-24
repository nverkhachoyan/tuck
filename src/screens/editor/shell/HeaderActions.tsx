import { StyleSheet, View } from "react-native";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { TextButton } from "@/ui/TextButton";
import { LAYERS_KEY } from "../shortcuts";

/**
 * The header's actions: Reset while the open tool has changes to take back,
 * the layers where the inspector doesn't show them, undo and redo, and
 * Export.
 */
export function HeaderActions({
	onReset,
	layers,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onExport,
}: {
	onReset?: () => void;
	layers?: { open: boolean; onToggle: () => void };
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onExport: () => void;
}) {
	return (
		<View style={styles.actions}>
			{onReset && <TextButton label="Reset" onPress={onReset} />}
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
