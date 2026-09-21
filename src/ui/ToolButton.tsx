import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

// Tools use MaterialCommunityIcons (photo-editor glyphs like format-text, crop,
// blur); small inline actions use Ionicons via IconButton.
type ToolIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** An editing tool in the bottom toolbar: an icon tile with a label under it. */
export function ToolButton({
	label,
	icon,
	onPress,
}: {
	label: string;
	icon: ToolIconName;
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
			<View style={styles.tile}>
				<MaterialCommunityIcons
					name={icon}
					size={28}
					color={colors.textPrimary}
				/>
			</View>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	);
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
	label: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
	},
});
