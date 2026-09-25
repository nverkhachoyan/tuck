import { StyleSheet, View } from "react-native";
import { ToolButton } from "../ToolButton";

/** The editing tools, in the bottom panel while no layer is selected. */
export function ToolsPanel({
	photoBusy,
	onAddText,
	onDraw,
	onRedact,
	onAddPhoto,
	onCrop,
}: {
	photoBusy: boolean;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onAddPhoto: () => void;
	onCrop: () => void;
}) {
	return (
		<View style={styles.row}>
			<ToolButton label="Text" icon="format-text" onPress={onAddText} />
			<ToolButton label="Draw" icon="draw" onPress={onDraw} />
			<ToolButton label="Redact" icon="blur" onPress={onRedact} />
			<ToolButton
				label="Photo"
				icon="image-plus"
				busy={photoBusy}
				onPress={onAddPhoto}
			/>
			<ToolButton label="Crop" icon="crop-rotate" onPress={onCrop} />
		</View>
	);
}

const styles = StyleSheet.create({
	// Tools sit centered as a group. Spaced like LayerActionsPanel, so five
	// still fit a phone's width.
	row: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
		paddingHorizontal: 12,
	},
});
