import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextLayer } from "../lib/editor-document";
import { colors } from "./theme";

const SWATCHES = ["#FFFFFF", "#000000", "#FF3B30", "#FFD60A", "#34C759", "#0A84FF"];

const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 160;

export function TextEditPanel({
	layer,
	onChangeText,
	onChangeFontSize,
	onChangeColor,
	onDelete,
	onDone,
}: {
	layer: TextLayer;
	onChangeText: (text: string) => void;
	onChangeFontSize: (fontSize: number) => void;
	onChangeColor: (color: string) => void;
	onDelete: () => void;
	onDone: () => void;
}) {
	return (
		<View style={styles.container}>
			<View style={styles.row}>
				<TextInput
					value={layer.text}
					onChangeText={onChangeText}
					placeholder="Text"
					placeholderTextColor={colors.textSecondary}
					style={styles.input}
					autoFocus
				/>
				<Pressable onPress={onDelete} hitSlop={8}>
					<Text style={styles.delete}>Delete</Text>
				</Pressable>
			</View>

			<View style={styles.row}>
				<View style={styles.swatches}>
					{SWATCHES.map((swatch) => (
						<Pressable
							key={swatch}
							onPress={() => onChangeColor(swatch)}
							style={[
								styles.swatch,
								{ backgroundColor: swatch },
								layer.color === swatch && styles.swatchSelected,
							]}
						/>
					))}
				</View>

				<View style={styles.sizeControls}>
					<Pressable
						onPress={() =>
							onChangeFontSize(Math.max(MIN_FONT_SIZE, layer.fontSize - 8))
						}
						hitSlop={8}
						style={styles.sizeButton}
					>
						<Text style={styles.sizeButtonLabel}>A-</Text>
					</Pressable>
					<Pressable
						onPress={() =>
							onChangeFontSize(Math.min(MAX_FONT_SIZE, layer.fontSize + 8))
						}
						hitSlop={8}
						style={styles.sizeButton}
					>
						<Text style={styles.sizeButtonLabel}>A+</Text>
					</Pressable>
				</View>

				<Pressable onPress={onDone} hitSlop={8}>
					<Text style={styles.done}>Done</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 20,
		paddingVertical: 14,
		gap: 14,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	input: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: 17,
		fontWeight: "600",
		backgroundColor: colors.surface,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	delete: {
		color: "#FF453A",
		fontSize: 15,
		fontWeight: "600",
	},
	swatches: {
		flexDirection: "row",
		gap: 8,
	},
	swatch: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
	},
	swatchSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	sizeControls: {
		flexDirection: "row",
		gap: 8,
	},
	sizeButton: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: colors.surface,
	},
	sizeButtonLabel: {
		color: colors.textPrimary,
		fontSize: 13,
		fontWeight: "600",
	},
	done: {
		color: colors.accent,
		fontSize: 15,
		fontWeight: "600",
	},
});
