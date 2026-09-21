import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

/** An editing tool in the bottom toolbar: an icon tile with a label under it. */
export function ToolButton({
	label,
	icon,
	onPress,
}: {
	label: string;
	icon: ReactNode;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={8}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => [styles.container, pressed && styles.pressed]}
		>
			<View style={styles.tile}>{icon}</View>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	);
}

/** A short glyph (like "Aa") drawn at icon size, for tools with no pictogram. */
export function GlyphIcon({ glyph }: { glyph: string }) {
	return <Text style={styles.glyph}>{glyph}</Text>;
}

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
		gap: 6,
	},
	pressed: {
		opacity: 0.6,
	},
	tile: {
		width: 52,
		height: 52,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surface,
	},
	glyph: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	label: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
	},
});
