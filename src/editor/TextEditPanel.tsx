import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FontSizeRange, TextLayer } from "@/model/document";
import { colors } from "@/theme";
import { IconButton } from "@/ui/IconButton";

const SWATCHES = [
	"#FFFFFF",
	"#000000",
	"#FF3B30",
	"#FFD60A",
	"#34C759",
	"#0A84FF",
];

type ColorTarget = "fill" | "outline";

type TextEditPanelProps = {
	layer: TextLayer;
	fontSizeRange: FontSizeRange;
	onChangeFontSize: (fontSize: number) => void;
	onChangeColor: (color: string) => void;
	onChangeOutlineColor: (color: string | null) => void;
	onDuplicate: () => void;
	onDelete: () => void;
};

/**
 * Styling for the selected text layer. The text itself is edited full-screen
 * (tap the selected layer), so this is only color, outline, and size. There's
 * no Done button: tapping anywhere on the canvas off the text deselects it.
 */
export function TextEditPanel({
	layer,
	fontSizeRange,
	onChangeFontSize,
	onChangeColor,
	onChangeOutlineColor,
	onDuplicate,
	onDelete,
}: TextEditPanelProps) {
	const [target, setTarget] = useState<ColorTarget>("fill");
	const current = target === "fill" ? layer.color : layer.outlineColor;
	const pick = target === "fill" ? onChangeColor : onChangeOutlineColor;

	return (
		<View style={styles.container}>
			<View style={styles.row}>
				<View style={styles.tabs}>
					<Tab
						label="Color"
						active={target === "fill"}
						onPress={() => setTarget("fill")}
					/>
					<Tab
						label="Outline"
						active={target === "outline"}
						onPress={() => setTarget("outline")}
					/>
				</View>
				<View style={styles.actions}>
					<IconButton
						icon="copy-outline"
						label="Duplicate"
						onPress={onDuplicate}
					/>
					<IconButton
						icon="trash-outline"
						label="Delete"
						tone="danger"
						onPress={onDelete}
					/>
				</View>
			</View>

			<View style={styles.row}>
				<View style={styles.swatches}>
					{/* Text always has a fill; only the outline can be turned off. */}
					{target === "outline" && (
						<Swatch
							color={null}
							selected={current === null}
							onPress={() => onChangeOutlineColor(null)}
						/>
					)}
					{SWATCHES.map((swatch) => (
						<Swatch
							key={swatch}
							color={swatch}
							selected={current === swatch}
							onPress={() => pick(swatch)}
						/>
					))}
				</View>

				<View style={styles.sizeControls}>
					<SizeButton
						label="A-"
						onPress={() =>
							onChangeFontSize(
								Math.max(
									fontSizeRange.min,
									layer.fontSize - fontSizeRange.step,
								),
							)
						}
					/>
					<SizeButton
						label="A+"
						onPress={() =>
							onChangeFontSize(
								Math.min(
									fontSizeRange.max,
									layer.fontSize + fontSizeRange.step,
								),
							)
						}
					/>
				</View>
			</View>
		</View>
	);
}

function Tab({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={8}
			onPress={onPress}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
		>
			<Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

/** A color choice; `null` is the "none" swatch, drawn with a slash. */
function Swatch({
	color,
	selected,
	onPress,
}: {
	color: string | null;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			// Half the gap between swatches, so neighbors' targets don't overlap.
			hitSlop={4}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={color ?? "No outline"}
			accessibilityState={{ selected }}
			style={[
				styles.swatch,
				color !== null && { backgroundColor: color },
				selected && styles.swatchSelected,
			]}
		>
			{color === null && <View style={styles.swatchSlash} />}
		</Pressable>
	);
}

function SizeButton({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable hitSlop={8} onPress={onPress} style={styles.sizeButton}>
			<Text style={styles.sizeButtonLabel}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 20,
		gap: 18,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	tabs: {
		flexDirection: "row",
		gap: 20,
	},
	tabLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	tabLabelActive: {
		color: colors.textPrimary,
	},
	actions: {
		flexDirection: "row",
		gap: 24,
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
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	swatchSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	swatchSlash: {
		width: 30,
		height: 2,
		backgroundColor: colors.textSecondary,
		transform: [{ rotate: "-45deg" }],
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
