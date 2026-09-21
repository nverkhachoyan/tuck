import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FontSizeRange, TextLayer } from "@/model/document";
import { colors } from "@/theme";
import { TextButton } from "@/ui/TextButton";

const SWATCHES = [
	"#FFFFFF",
	"#000000",
	"#FF3B30",
	"#FFD60A",
	"#34C759",
	"#0A84FF",
];

type TextEditPanelProps = {
	layer: TextLayer;
	fontSizeRange: FontSizeRange;
	onEditText: () => void;
	onChangeFontSize: (fontSize: number) => void;
	onChangeColor: (color: string) => void;
	onDelete: () => void;
	onDone: () => void;
};

export function TextEditPanel({
	layer,
	fontSizeRange,
	onEditText,
	onChangeFontSize,
	onChangeColor,
	onDelete,
	onDone,
}: TextEditPanelProps) {
	return (
		<View style={styles.container}>
			<View style={styles.row}>
				{/* Looks like a field; opens the full-screen editor. */}
				<Pressable
					onPress={onEditText}
					style={styles.textPreview}
					accessibilityRole="button"
					accessibilityLabel="Edit text"
				>
					<Text style={styles.textPreviewLabel} numberOfLines={1}>
						{layer.text}
					</Text>
				</Pressable>
				<TextButton label="Delete" tone="danger" onPress={onDelete} />
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
							onChangeFontSize(
								Math.max(
									fontSizeRange.min,
									layer.fontSize - fontSizeRange.step,
								),
							)
						}
						hitSlop={8}
						style={styles.sizeButton}
					>
						<Text style={styles.sizeButtonLabel}>A-</Text>
					</Pressable>
					<Pressable
						onPress={() =>
							onChangeFontSize(
								Math.min(
									fontSizeRange.max,
									layer.fontSize + fontSizeRange.step,
								),
							)
						}
						hitSlop={8}
						style={styles.sizeButton}
					>
						<Text style={styles.sizeButtonLabel}>A+</Text>
					</Pressable>
				</View>

				<TextButton label="Done" tone="accent" onPress={onDone} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 20,
		gap: 14,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	textPreview: {
		flex: 1,
		backgroundColor: colors.surface,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	textPreviewLabel: {
		color: colors.textPrimary,
		fontSize: 17,
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
});
